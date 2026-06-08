import { execFileSync } from "node:child_process";
import { HttpsProxyAgent } from "https-proxy-agent";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

function normalizeProxyUrl(value: string | undefined) {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;

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
  if (process.platform !== "win32") return undefined;

  try {
    const key = "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings";
    const proxyEnabled = execFileSync("reg", ["query", key, "/v", "ProxyEnable"], {
      encoding: "utf8",
      timeout: 2000,
      windowsHide: true
    });
    if (!/\b0x1\b/i.test(proxyEnabled)) return undefined;

    const proxyServer = execFileSync("reg", ["query", key, "/v", "ProxyServer"], {
      encoding: "utf8",
      timeout: 2000,
      windowsHide: true
    });
    const match = proxyServer.match(/ProxyServer\s+REG_SZ\s+(.+)/i);
    return normalizeProxyUrl(match?.[1]);
  } catch {
    return undefined;
  }
}

function getDevProxyAgent() {
  const proxyUrl =
    normalizeProxyUrl(process.env.HTTPS_PROXY) ??
    normalizeProxyUrl(process.env.HTTP_PROXY) ??
    normalizeProxyUrl(process.env.ALL_PROXY) ??
    readWindowsProxy();

  return proxyUrl ? new HttpsProxyAgent(proxyUrl) : undefined;
}

const devProxyAgent = getDevProxyAgent();

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/eapi": {
        target: "https://eapi.binance.com",
        changeOrigin: true,
        secure: true,
        agent: devProxyAgent
      }
    }
  }
});
