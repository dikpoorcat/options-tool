from __future__ import annotations

import os
import platform
import time
from datetime import datetime
from typing import Any

import requests

BASE_URL = "https://eapi.binance.com"
DAY_MS = 24 * 60 * 60 * 1000

last_good_snapshot: dict[str, Any] | None = None


def normalize_proxy_url(value: str | None) -> str | None:
    if not value:
        return None

    trimmed = value.strip()
    if not trimmed:
        return None

    parts = [part.strip() for part in trimmed.split(";") if part.strip()]
    proxy_entry = next((part for part in parts if part.lower().startswith("https=")), None)
    proxy_entry = proxy_entry or next((part for part in parts if part.lower().startswith("http=")), None)
    proxy_entry = proxy_entry or trimmed

    proxy_value = proxy_entry.split("=", 1)[1] if "=" in proxy_entry else proxy_entry
    if proxy_value.lower().startswith(("http://", "https://")):
        return proxy_value
    return f"http://{proxy_value}"


def read_windows_proxy() -> str | None:
    if platform.system() != "Windows":
        return None

    try:
        import winreg

        path = r"Software\Microsoft\Windows\CurrentVersion\Internet Settings"
        with winreg.OpenKey(winreg.HKEY_CURRENT_USER, path) as key:
            proxy_enabled = winreg.QueryValueEx(key, "ProxyEnable")[0]
            if proxy_enabled != 1:
                return None
            proxy_server = winreg.QueryValueEx(key, "ProxyServer")[0]
            return normalize_proxy_url(str(proxy_server))
    except OSError:
        return None


def get_proxy_url() -> str | None:
    return (
        normalize_proxy_url(os.environ.get("HTTPS_PROXY"))
        or normalize_proxy_url(os.environ.get("HTTP_PROXY"))
        or normalize_proxy_url(os.environ.get("ALL_PROXY"))
        or read_windows_proxy()
    )


def request_json(path: str) -> Any:
    proxy_url = get_proxy_url()
    if proxy_url:
        try:
            return request_json_with_proxy(path, proxy_url)
        except requests.RequestException:
            return request_json_with_proxy(path, None)

    return request_json_with_proxy(path, None)


def request_json_with_proxy(path: str, proxy_url: str | None) -> Any:
    proxies = {"http": proxy_url, "https": proxy_url} if proxy_url else None
    response = requests.get(f"{BASE_URL}{path}", proxies=proxies, timeout=30)
    if not response.ok:
        raise RuntimeError(f"{path} {response.status_code}")
    return response.json()


def to_number(value: Any) -> float | None:
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return None
    return parsed if parsed == parsed and parsed not in (float("inf"), float("-inf")) else None


def parse_option_symbol(symbol: str) -> dict[str, Any] | None:
    parts = symbol.split("-")
    if len(parts) != 4:
        return None

    underlying, date_part, strike_part, side_part = parts
    strike = to_number(strike_part)
    if not underlying or not date_part or strike is None:
        return None
    if side_part not in ("P", "C"):
        return None

    return {
        "underlying": underlying,
        "datePart": date_part,
        "strike": strike,
        "side": "PUT" if side_part == "P" else "CALL",
    }


def days_to_expiry(expiry_ms: float, now_ms: float) -> float:
    return max(0, (expiry_ms - now_ms) / DAY_MS)


def format_expiry(expiry_ms: float) -> str:
    return datetime.fromtimestamp(expiry_ms / 1000).strftime("%m/%d %H:%M")


def fetch_btc_put_snapshot(now_ms: int | None = None) -> dict[str, Any]:
    global last_good_snapshot

    now = now_ms or int(time.time() * 1000)

    try:
        exchange_info, marks, index = (
            request_json("/eapi/v1/exchangeInfo"),
            request_json("/eapi/v1/mark"),
            request_json("/eapi/v1/index?underlying=BTCUSDT"),
        )

        mark_by_symbol = {item.get("symbol"): to_number(item.get("markPrice")) for item in marks}
        contracts = []

        for item in exchange_info.get("optionSymbols", []):
            symbol = item.get("symbol", "")
            parsed = parse_option_symbol(symbol)
            expiry = item.get("expiryDate") or 0
            strike = to_number(item.get("strikePrice"))
            if strike is None and parsed:
                strike = parsed["strike"]
            side = "PUT" if item.get("side") == "PUT" or (parsed and parsed["side"] == "PUT") else "CALL"

            if not parsed or parsed["underlying"] != "BTC":
                continue
            if side != "PUT":
                continue
            if not isinstance(expiry, (int, float)) or expiry <= now:
                continue
            if strike is None:
                continue
            if item.get("status") and item.get("status") != "TRADING":
                continue

            contracts.append(
                {
                    "symbol": symbol,
                    "expiry": expiry,
                    "expiryLabel": format_expiry(expiry),
                    "strike": strike,
                    "side": "PUT",
                    "markPrice": mark_by_symbol.get(symbol),
                    "daysToExpiry": days_to_expiry(expiry, now),
                }
            )

        snapshot = {
            "underlying": "BTC",
            "indexPrice": to_number(index.get("indexPrice")),
            "serverTime": exchange_info.get("serverTime") or now,
            "updatedAt": now,
            "contracts": contracts,
            "stale": False,
        }
        last_good_snapshot = snapshot
        return snapshot
    except Exception as error:
        message = str(error) or "Binance request failed"
        if last_good_snapshot:
            return {**last_good_snapshot, "stale": True, "sourceError": message}
        raise RuntimeError(message) from error
