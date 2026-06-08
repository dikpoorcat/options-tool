from __future__ import annotations

from server import binance


def test_combines_exchange_info_mark_prices_and_index(monkeypatch):
    now = 1780891200000
    expiry = now + 10 * 24 * 60 * 60 * 1000

    def fake_request_json(path: str):
        if "/exchangeInfo" in path:
            return {
                "serverTime": now,
                "optionSymbols": [
                    {
                        "symbol": "BTC-260618-62000-P",
                        "side": "PUT",
                        "expiryDate": expiry,
                        "strikePrice": "62000",
                        "status": "TRADING",
                    },
                    {
                        "symbol": "BTC-260618-62000-C",
                        "side": "CALL",
                        "expiryDate": expiry,
                        "strikePrice": "62000",
                        "status": "TRADING",
                    },
                ],
            }
        if "/mark" in path:
            return [{"symbol": "BTC-260618-62000-P", "markPrice": "1000"}]
        return {"indexPrice": "62500"}

    monkeypatch.setattr(binance, "request_json", fake_request_json)
    binance.last_good_snapshot = None

    snapshot = binance.fetch_btc_put_snapshot(now)

    assert snapshot["indexPrice"] == 62500
    assert len(snapshot["contracts"]) == 1
    assert snapshot["contracts"][0]["symbol"] == "BTC-260618-62000-P"
    assert snapshot["contracts"][0]["strike"] == 62000
    assert snapshot["contracts"][0]["markPrice"] == 1000
    assert snapshot["contracts"][0]["daysToExpiry"] == 10


def test_filters_non_displayable_contracts(monkeypatch):
    now = 1780891200000
    future_expiry = now + 7 * 24 * 60 * 60 * 1000
    past_expiry = now - 24 * 60 * 60 * 1000

    def fake_request_json(path: str):
        if "/exchangeInfo" in path:
            return {
                "serverTime": now,
                "optionSymbols": [
                    {
                        "symbol": "BTC-260615-61000-P",
                        "side": "PUT",
                        "expiryDate": future_expiry,
                        "strikePrice": "61000",
                        "status": "TRADING",
                    },
                    {
                        "symbol": "BTC-260615-61000-C",
                        "side": "CALL",
                        "expiryDate": future_expiry,
                        "strikePrice": "61000",
                        "status": "TRADING",
                    },
                    {
                        "symbol": "BTC-260607-60000-P",
                        "side": "PUT",
                        "expiryDate": past_expiry,
                        "strikePrice": "60000",
                        "status": "TRADING",
                    },
                    {
                        "symbol": "ETH-260615-3000-P",
                        "side": "PUT",
                        "expiryDate": future_expiry,
                        "strikePrice": "3000",
                        "status": "TRADING",
                    },
                    {
                        "symbol": "BTC-260615-59000-P",
                        "side": "PUT",
                        "expiryDate": future_expiry,
                        "strikePrice": "59000",
                        "status": "SETTLING",
                    },
                ],
            }
        if "/mark" in path:
            return [{"symbol": "BTC-260615-61000-P", "markPrice": "500"}]
        return {"indexPrice": "62000"}

    monkeypatch.setattr(binance, "request_json", fake_request_json)
    binance.last_good_snapshot = None

    snapshot = binance.fetch_btc_put_snapshot(now)

    assert [contract["symbol"] for contract in snapshot["contracts"]] == ["BTC-260615-61000-P"]


def test_returns_stale_snapshot_after_later_failure(monkeypatch):
    now = 1780891200000
    expiry = now + 3 * 24 * 60 * 60 * 1000
    responses = iter(
        [
            {
                "serverTime": now,
                "optionSymbols": [
                    {
                        "symbol": "BTC-260611-60000-P",
                        "side": "PUT",
                        "expiryDate": expiry,
                        "strikePrice": "60000",
                        "status": "TRADING",
                    }
                ],
            },
            [{"symbol": "BTC-260611-60000-P", "markPrice": "250"}],
            {"indexPrice": "61500"},
        ]
    )

    def fake_request_json(_path: str):
        return next(responses)

    monkeypatch.setattr(binance, "request_json", fake_request_json)
    binance.last_good_snapshot = None

    fresh = binance.fetch_btc_put_snapshot(now)

    def failing_request_json(_path: str):
        raise RuntimeError("network down")

    monkeypatch.setattr(binance, "request_json", failing_request_json)
    stale = binance.fetch_btc_put_snapshot(now + 60_000)

    assert fresh["stale"] is False
    assert stale["stale"] is True
    assert stale["sourceError"] == "network down"
    assert stale["contracts"][0]["symbol"] == "BTC-260611-60000-P"
