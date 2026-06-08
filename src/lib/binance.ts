import { daysToExpiry, formatExpiry, parseOptionSymbol } from "./options";
import type { OptionContract, OptionSnapshot } from "../types";

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

async function requestJson<T>(path: string): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`);
  if (!response.ok) {
    throw new Error(`${path} ${response.status}`);
  }
  return response.json() as Promise<T>;
}

function toNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function clearBtcPutSnapshotCache() {
  lastGoodSnapshot = null;
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
