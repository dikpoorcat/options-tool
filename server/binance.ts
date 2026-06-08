import { execFileSync } from "node:child_process";
import { ProxyAgent, request } from "undici";
import { daysToExpiry, formatExpiry, parseOptionSymbol } from "../src/lib/options";
import type { OptionContract, OptionSnapshot } from "../src/types";

const BASE_URL = "https://eapi.binance.com";

interface BinanceExchangeInfo {
  serverTime?: number;
  optionSymbols?: Array<{
    symbol: string;
    underlying?: string;
    side?: string;
    expiryDate?: number;
    strikePrice?: string;
    status?: string;
  }>;
}

interface BinanceMark {
  symbol: string;
  markPrice?: string;
}

interface BinanceIndex {
  indexPrice?: string;
}

let lastGoodSnapshot: OptionSnapshot | null = null;

function normalizeProxyUrl(value: string | undefined) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const proxyEntry =
    trimmed
      .split(";")
      .map((part) => part.trim())
      .find((part) => part.toLowerCase().startsWith("https=")) ??
    trimmed
      .split(";")
      .map((part) => part.trim())
      .find((part) => part.toLowerCase().startsWith("http=")) ??
    trimmed;

  const proxyValue = proxyEntry.includes("=") ? proxyEntry.split("=").slice(1).join("=") : proxyEntry;
  return /^https?:\/\//i.test(proxyValue) ? proxyValue : `http://${proxyValue}`;
}

function readWindowsProxy() {
  if (process.platform !== "win32") return null;

  try {
    const key = "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings";
    const proxyEnabled = execFileSync("reg", ["query", key, "/v", "ProxyEnable"], {
      encoding: "utf8",
      timeout: 2000,
      windowsHide: true
    });
    if (!/\b0x1\b/i.test(proxyEnabled)) return null;

    const proxyServer = execFileSync("reg", ["query", key, "/v", "ProxyServer"], {
      encoding: "utf8",
      timeout: 2000,
      windowsHide: true
    });
    const match = proxyServer.match(/ProxyServer\s+REG_SZ\s+(.+)/i);
    return normalizeProxyUrl(match?.[1]);
  } catch {
    return null;
  }
}

function getProxyUrl() {
  return (
    normalizeProxyUrl(process.env.HTTPS_PROXY) ??
    normalizeProxyUrl(process.env.HTTP_PROXY) ??
    normalizeProxyUrl(process.env.ALL_PROXY) ??
    readWindowsProxy()
  );
}

async function requestJson<T>(path: string): Promise<T> {
  const url = `${BASE_URL}${path}`;
  const proxyUrl = getProxyUrl();

  if (proxyUrl) {
    try {
      return await requestJsonWithDispatcher<T>(url, proxyUrl);
    } catch {
      return requestJsonWithDispatcher<T>(url);
    }
  }

  try {
    return await requestJsonWithDispatcher<T>(url);
  } catch (error) {
    throw error;
  }
}

async function requestJsonWithDispatcher<T>(url: string, proxyUrl?: string): Promise<T> {
  const response = await request(url, {
    dispatcher: proxyUrl ? new ProxyAgent(proxyUrl) : undefined,
    bodyTimeout: 30_000,
    headersTimeout: 30_000
  });

  const text = await response.body.text();
  if (response.statusCode < 200 || response.statusCode >= 300) {
    throw new Error(`${url.replace(BASE_URL, "")} ${response.statusCode}`);
  }

  return JSON.parse(text) as T;
}

function toNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function fetchBtcPutSnapshot(nowMs = Date.now()): Promise<OptionSnapshot> {
  try {
    const [exchangeInfo, marks, index] = await Promise.all([
      requestJson<BinanceExchangeInfo>("/eapi/v1/exchangeInfo"),
      requestJson<BinanceMark[]>("/eapi/v1/mark"),
      requestJson<BinanceIndex>("/eapi/v1/index?underlying=BTCUSDT")
    ]);

    const markBySymbol = new Map(marks.map((mark) => [mark.symbol, toNumber(mark.markPrice)]));
    const contracts: OptionContract[] = [];

    for (const item of exchangeInfo.optionSymbols ?? []) {
      const parsed = parseOptionSymbol(item.symbol);
      const expiry = item.expiryDate ?? 0;
      const strike = toNumber(item.strikePrice) ?? parsed?.strike;
      const side = item.side === "PUT" || parsed?.side === "PUT" ? "PUT" : "CALL";

      if (!parsed || parsed.underlying !== "BTC") continue;
      if (side !== "PUT") continue;
      if (!Number.isFinite(expiry) || expiry <= nowMs) continue;
      if (typeof strike !== "number" || !Number.isFinite(strike)) continue;
      if (item.status && item.status !== "TRADING") continue;

      contracts.push({
        symbol: item.symbol,
        expiry,
        expiryLabel: formatExpiry(expiry),
        strike,
        side: "PUT",
        markPrice: markBySymbol.get(item.symbol) ?? null,
        daysToExpiry: daysToExpiry(expiry, nowMs)
      });
    }

    const snapshot: OptionSnapshot = {
      underlying: "BTC",
      indexPrice: toNumber(index.indexPrice),
      serverTime: exchangeInfo.serverTime ?? nowMs,
      updatedAt: nowMs,
      contracts,
      stale: false
    };

    lastGoodSnapshot = snapshot;
    return snapshot;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Binance request failed";
    if (lastGoodSnapshot) {
      return {
        ...lastGoodSnapshot,
        stale: true,
        sourceError: message
      };
    }
    throw new Error(message);
  }
}
