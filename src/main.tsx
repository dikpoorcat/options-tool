import React from "react";
import ReactDOM from "react-dom/client";
import { RefreshCw } from "lucide-react";
import { buildMatrix, selectNearbyStrikes } from "./lib/options";
import type { OptionSnapshot, YieldMode } from "./types";
import "./styles.css";

const REFRESH_MS = 30_000;

function formatNumber(value: number | null | undefined, digits = 0) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "-";
  return new Intl.NumberFormat("zh-CN", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits
  }).format(value);
}

function formatPercent(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "-";
  return `${formatNumber(value, value >= 100 ? 1 : 2)}%`;
}

function useOptionSnapshot() {
  const [snapshot, setSnapshot] = React.useState<OptionSnapshot | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/options/btc-put");
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Load failed");
      setSnapshot(data);
      setError(data.sourceError ?? null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), REFRESH_MS);
    return () => window.clearInterval(id);
  }, [load]);

  return { snapshot, error, loading, reload: load };
}

function App() {
  const { snapshot, error, loading, reload } = useOptionSnapshot();
  const [margin, setMargin] = React.useState(10000);
  const [referencePrice, setReferencePrice] = React.useState<number | "">("");
  const [strikeCount, setStrikeCount] = React.useState(4);
  const [yieldMode, setYieldMode] = React.useState<YieldMode>("actual");
  const [lockedStrikes, setLockedStrikes] = React.useState<number[]>([]);

  React.useEffect(() => {
    if (referencePrice === "" && snapshot?.indexPrice) {
      setReferencePrice(Math.round(snapshot.indexPrice / 1000) * 1000);
    }
  }, [referencePrice, snapshot?.indexPrice]);

  const strikes = React.useMemo(
    () => Array.from(new Set((snapshot?.contracts ?? []).map((contract) => contract.strike))),
    [snapshot]
  );

  const selectedStrikes = React.useMemo(() => {
    const auto = selectNearbyStrikes(strikes, Number(referencePrice), strikeCount);
    return Array.from(new Set([...auto, ...lockedStrikes])).sort((a, b) => b - a);
  }, [lockedStrikes, referencePrice, strikeCount, strikes]);

  const rows = React.useMemo(
    () => buildMatrix(snapshot?.contracts ?? [], selectedStrikes, margin),
    [margin, selectedStrikes, snapshot]
  );

  const visibleYields = rows.flatMap((row) =>
    selectedStrikes.map((strike) =>
      yieldMode === "actual" ? row.cells[strike]?.actualYield : row.cells[strike]?.cashSecuredYield
    )
  );
  const maxYield = Math.max(1, ...visibleYields.filter((value): value is number => Number.isFinite(value)));

  return (
    <main className="app-shell">
      <section className="top-band">
        <div>
          <p className="eyebrow">Binance BTC European Options</p>
          <h1>BTC Put Yield Matrix</h1>
        </div>
        <button className="icon-button refresh" onClick={() => void reload()} title="Refresh now" disabled={loading}>
          <RefreshCw size={18} className={loading ? "spin" : ""} />
          <span>Refresh</span>
        </button>
      </section>

      <section className="controls">
        <label>
          <span>BTC Index</span>
          <output>{formatNumber(snapshot?.indexPrice, 2)} USDT</output>
        </label>
        <label>
          <span>Reference</span>
          <input
            type="number"
            value={referencePrice}
            onChange={(event) => setReferencePrice(event.target.value === "" ? "" : Number(event.target.value))}
            min="0"
            step="100"
          />
        </label>
        <label>
          <span>Margin / Contract</span>
          <input
            type="number"
            value={margin}
            onChange={(event) => setMargin(Math.max(1, Number(event.target.value)))}
            min="0"
            step="100"
          />
        </label>
        <label>
          <span>Nearby Strikes</span>
          <input
            type="number"
            value={strikeCount}
            onChange={(event) => setStrikeCount(Math.max(1, Math.min(12, Number(event.target.value))))}
            min="1"
            max="12"
          />
        </label>
        <div className="segmented" role="group" aria-label="Yield mode">
          <button className={yieldMode === "actual" ? "active" : ""} onClick={() => setYieldMode("actual")}>
            Actual Yield
          </button>
          <button className={yieldMode === "cashSecured" ? "active" : ""} onClick={() => setYieldMode("cashSecured")}>
            Secured Yield
          </button>
        </div>
      </section>

      <section className="status-line">
        <span>{snapshot ? `Updated ${new Date(snapshot.updatedAt).toLocaleTimeString("zh-CN")}` : "Waiting for data"}</span>
        {snapshot?.stale ? <strong>Showing last successful snapshot</strong> : null}
        {error ? <strong>{error}</strong> : null}
      </section>

      <section className="matrix-wrap">
        <table>
          <thead>
            <tr>
              <th className="sticky">Expiry</th>
              <th>Days</th>
              {selectedStrikes.map((strike) => (
                <th key={strike}>
                  <button
                    className={lockedStrikes.includes(strike) ? "strike locked" : "strike"}
                    onClick={() =>
                      setLockedStrikes((current) =>
                        current.includes(strike) ? current.filter((item) => item !== strike) : [...current, strike]
                      )
                    }
                    title="Lock or unlock this strike"
                  >
                    {strike}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.expiry}>
                <th className="sticky row-title">{row.expiryLabel}</th>
                <td className="days">{formatNumber(row.daysToExpiry, 4)}</td>
                {selectedStrikes.map((strike) => {
                  const cell = row.cells[strike];
                  const yieldValue = yieldMode === "actual" ? cell?.actualYield : cell?.cashSecuredYield;
                  const barWidth = yieldValue ? Math.min(100, (yieldValue / maxYield) * 100) : 0;

                  return (
                    <td key={`${row.expiry}-${strike}`} className="yield-cell">
                      {cell ? (
                        <>
                          <div className="bar" style={{ width: `${barWidth}%` }} />
                          <span className="premium">{formatNumber(cell.premium, 2)}</span>
                          <strong>{formatPercent(yieldValue)}</strong>
                        </>
                      ) : (
                        <span className="empty">-</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && rows.length === 0 ? <div className="empty-state">No BTC Put contracts to display</div> : null}
      </section>
    </main>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
