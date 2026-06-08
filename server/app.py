from __future__ import annotations

import os
import time

from flask import Flask, jsonify
from flask_cors import CORS

try:
    from .binance import fetch_btc_put_snapshot
except ImportError:
    from binance import fetch_btc_put_snapshot


def create_app() -> Flask:
    app = Flask(__name__)
    CORS(app)

    @app.get("/api/health")
    def health():
        return jsonify({"ok": True, "now": int(time.time() * 1000)})

    @app.get("/api/options/btc-put")
    def btc_put_options():
        try:
            return jsonify(fetch_btc_put_snapshot())
        except RuntimeError as error:
            return jsonify({"error": str(error) or "Unable to load Binance option data"}), 502

    return app


app = create_app()


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "8787"))
    host = os.environ.get("HOST", "127.0.0.1")
    app.run(host=host, port=port)
