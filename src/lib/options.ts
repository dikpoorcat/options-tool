import type { MatrixRow, OptionContract } from "../types";

const DAY_MS = 24 * 60 * 60 * 1000;

export function parseOptionSymbol(symbol: string) {
  const parts = symbol.split("-");
  if (parts.length !== 4) return null;

  const [underlying, datePart, strikePart, sidePart] = parts;
  const strike = Number(strikePart);
  if (!underlying || !datePart || !Number.isFinite(strike)) return null;
  if (sidePart !== "P" && sidePart !== "C") return null;

  return {
    underlying,
    datePart,
    strike,
    side: sidePart === "P" ? ("PUT" as const) : ("CALL" as const)
  };
}

export function daysToExpiry(expiryMs: number, nowMs: number) {
  return Math.max(0, (expiryMs - nowMs) / DAY_MS);
}

export function annualizedYield(premium: number, denominator: number, days: number) {
  if (premium <= 0 || denominator <= 0 || days <= 0) return null;
  return (premium / denominator) * (365 / days) * 100;
}

export function selectNearbyStrikes(strikes: number[], referencePrice: number, count: number) {
  if (!Number.isFinite(referencePrice) || referencePrice <= 0) return [];
  const unique = Array.from(new Set(strikes)).sort((a, b) => a - b);
  const validCount = Math.max(1, Math.floor(count));

  return unique
    .map((strike) => ({ strike, distance: Math.abs(strike - referencePrice) }))
    .sort((a, b) => a.distance - b.distance || a.strike - b.strike)
    .slice(0, validCount)
    .map((item) => item.strike)
    .sort((a, b) => b - a);
}

export function buildMatrix(
  contracts: OptionContract[],
  selectedStrikes: number[],
  marginPerContract: number
): MatrixRow[] {
  const rows = new Map<number, MatrixRow>();

  for (const contract of contracts) {
    if (!selectedStrikes.includes(contract.strike)) continue;

    const row =
      rows.get(contract.expiry) ??
      {
        expiry: contract.expiry,
        expiryLabel: contract.expiryLabel,
        daysToExpiry: contract.daysToExpiry,
        cells: {}
      };

    const premium = contract.markPrice ?? 0;
    row.cells[contract.strike] = {
      contract,
      premium,
      actualYield: annualizedYield(premium, marginPerContract, contract.daysToExpiry),
      cashSecuredYield: annualizedYield(premium, contract.strike, contract.daysToExpiry)
    };
    rows.set(contract.expiry, row);
  }

  return Array.from(rows.values()).sort((a, b) => a.expiry - b.expiry);
}

export function formatExpiry(expiryMs: number) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(new Date(expiryMs));
}
