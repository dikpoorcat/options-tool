import { describe, expect, it } from "vitest";
import {
  annualizedYield,
  buildMatrix,
  daysToExpiry,
  filterStrikesByInterval,
  parseOptionSymbol,
  selectNearbyStrikes
} from "../src/lib/options";
import type { OptionContract } from "../src/types";

describe("option helpers", () => {
  it("parses Binance option symbols", () => {
    expect(parseOptionSymbol("BTC-240628-63000-P")).toEqual({
      underlying: "BTC",
      datePart: "240628",
      strike: 63000,
      side: "PUT"
    });
    expect(parseOptionSymbol("BTC-240628-63000-X")).toBeNull();
  });

  it("calculates non-negative days to expiry", () => {
    const now = Date.UTC(2026, 5, 8);
    expect(daysToExpiry(now + 12 * 60 * 60 * 1000, now)).toBe(0.5);
    expect(daysToExpiry(now - 1, now)).toBe(0);
  });

  it("calculates annualized yields", () => {
    expect(annualizedYield(100, 10000, 10)).toBeCloseTo(36.5);
    expect(annualizedYield(0, 10000, 10)).toBeNull();
  });

  it("selects nearby strikes around a reference price", () => {
    expect(selectNearbyStrikes([60000, 61000, 62000, 63000, 64000], 62500, 4)).toEqual([
      64000, 63000, 62000, 61000
    ]);
  });

  it("filters strikes by interval", () => {
    expect(filterStrikesByInterval([62000, 62500, 63000, 63500], 1000)).toEqual([62000, 63000]);
    expect(filterStrikesByInterval([62000, 62500, 63000, 63500], 500)).toEqual([62000, 62500, 63000, 63500]);
  });

  it("builds matrix rows with actual and cash-secured yields", () => {
    const contracts: OptionContract[] = [
      {
        symbol: "BTC-260626-62000-P",
        expiry: Date.UTC(2026, 5, 26),
        expiryLabel: "06/26 08:00",
        strike: 62000,
        side: "PUT",
        markPrice: 1000,
        daysToExpiry: 10
      }
    ];

    const rows = buildMatrix(contracts, [62000], 10000);
    expect(rows).toHaveLength(1);
    expect(rows[0].cells[62000].actualYield).toBeCloseTo(365);
    expect(rows[0].cells[62000].cashSecuredYield).toBeCloseTo(58.8709);
  });
});
