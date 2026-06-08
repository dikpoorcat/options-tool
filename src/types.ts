export type PremiumPriceMode = "mark";
export type YieldMode = "actual" | "cashSecured";

export interface OptionContract {
  symbol: string;
  expiry: number;
  expiryLabel: string;
  strike: number;
  side: "PUT" | "CALL";
  markPrice: number | null;
  daysToExpiry: number;
}

export interface OptionSnapshot {
  underlying: "BTC";
  indexPrice: number | null;
  serverTime: number;
  updatedAt: number;
  contracts: OptionContract[];
  stale: boolean;
  sourceError?: string;
}

export interface MatrixCell {
  contract: OptionContract | null;
  premium: number;
  actualYield: number | null;
  cashSecuredYield: number | null;
}

export interface MatrixRow {
  expiry: number;
  expiryLabel: string;
  daysToExpiry: number;
  cells: Record<number, MatrixCell>;
}
