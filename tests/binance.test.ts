import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearBtcPutSnapshotCache, fetchBtcPutSnapshot } from "../src/lib/binance";

function jsonResponse(body: unknown) {
  return {
    ok: true,
    status: 200,
    json: async () => body
  } as Response;
}

describe("Binance snapshot loader", () => {
  beforeEach(() => {
    clearBtcPutSnapshotCache();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("combines exchange info, mark prices, and index price into BTC put contracts", async () => {
    const now = Date.UTC(2026, 5, 8);
    const expiry = now + 10 * 24 * 60 * 60 * 1000;

    const fetchMock = vi.fn(async (url: string) => {
        if (url.includes("/exchangeInfo")) {
          return jsonResponse({
            serverTime: now,
            optionSymbols: [
              {
                symbol: "BTC-260618-62000-P",
                side: "PUT",
                expiryDate: expiry,
                strikePrice: "62000",
                status: "TRADING"
              },
              {
                symbol: "BTC-260618-62000-C",
                side: "CALL",
                expiryDate: expiry,
                strikePrice: "62000",
                status: "TRADING"
              }
            ]
          });
        }

        if (url.includes("/mark")) {
          return jsonResponse([
            {
              symbol: "BTC-260618-62000-P",
              markPrice: "1000"
            }
          ]);
        }

        return jsonResponse({
          indexPrice: "62500"
        });
      });

    vi.stubGlobal("fetch", fetchMock);

    const snapshot = await fetchBtcPutSnapshot(now);

    expect(fetchMock).toHaveBeenCalledWith("/eapi/v1/exchangeInfo");
    expect(fetchMock).toHaveBeenCalledWith("/eapi/v1/mark");
    expect(fetchMock).toHaveBeenCalledWith("/eapi/v1/index?underlying=BTCUSDT");
    expect(snapshot.indexPrice).toBe(62500);
    expect(snapshot.contracts).toHaveLength(1);
    expect(snapshot.contracts[0]).toMatchObject({
      symbol: "BTC-260618-62000-P",
      strike: 62000,
      markPrice: 1000,
      daysToExpiry: 10
    });
  });

  it("filters out calls, expired contracts, non-BTC contracts, and non-trading contracts", async () => {
    const now = Date.UTC(2026, 5, 8);
    const futureExpiry = now + 7 * 24 * 60 * 60 * 1000;
    const pastExpiry = now - 24 * 60 * 60 * 1000;

    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("/exchangeInfo")) {
          return jsonResponse({
            serverTime: now,
            optionSymbols: [
              {
                symbol: "BTC-260615-61000-P",
                side: "PUT",
                expiryDate: futureExpiry,
                strikePrice: "61000",
                status: "TRADING"
              },
              {
                symbol: "BTC-260615-61000-C",
                side: "CALL",
                expiryDate: futureExpiry,
                strikePrice: "61000",
                status: "TRADING"
              },
              {
                symbol: "BTC-260607-60000-P",
                side: "PUT",
                expiryDate: pastExpiry,
                strikePrice: "60000",
                status: "TRADING"
              },
              {
                symbol: "ETH-260615-3000-P",
                side: "PUT",
                expiryDate: futureExpiry,
                strikePrice: "3000",
                status: "TRADING"
              },
              {
                symbol: "BTC-260615-59000-P",
                side: "PUT",
                expiryDate: futureExpiry,
                strikePrice: "59000",
                status: "SETTLING"
              }
            ]
          });
        }

        if (url.includes("/mark")) {
          return jsonResponse([
            {
              symbol: "BTC-260615-61000-P",
              markPrice: "500"
            }
          ]);
        }

        return jsonResponse({
          indexPrice: "62000"
        });
      })
    );

    const snapshot = await fetchBtcPutSnapshot(now);

    expect(snapshot.contracts.map((contract) => contract.symbol)).toEqual(["BTC-260615-61000-P"]);
  });

  it("returns the last successful snapshot as stale data after a later Binance failure", async () => {
    const now = Date.UTC(2026, 5, 8);
    const expiry = now + 3 * 24 * 60 * 60 * 1000;
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(async () =>
        jsonResponse({
          serverTime: now,
          optionSymbols: [
            {
              symbol: "BTC-260611-60000-P",
              side: "PUT",
              expiryDate: expiry,
              strikePrice: "60000",
              status: "TRADING"
            }
          ]
        })
      )
      .mockImplementationOnce(async () =>
        jsonResponse([
          {
            symbol: "BTC-260611-60000-P",
            markPrice: "250"
          }
        ])
      )
      .mockImplementationOnce(async () =>
        jsonResponse({
          indexPrice: "61500"
        })
      )
      .mockRejectedValue(new Error("network down"));

    vi.stubGlobal("fetch", fetchMock);

    const fresh = await fetchBtcPutSnapshot(now);
    const stale = await fetchBtcPutSnapshot(now + 60_000);

    expect(fresh.stale).toBe(false);
    expect(stale.stale).toBe(true);
    expect(stale.sourceError).toBe("network down");
    expect(stale.contracts).toHaveLength(1);
    expect(stale.contracts[0].symbol).toBe("BTC-260611-60000-P");
  });
});
