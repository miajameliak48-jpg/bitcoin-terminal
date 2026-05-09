import { useState } from 'react';
import { useTickerStore, useBalanceStore } from '../store';
import { calculateRisk } from '../services/api';

function fmt(n: number, d = 2) {
  return n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
}

interface RiskResult {
  riskAmount: number;
  positionSizeBTC: number;
  positionValueUSDT: number;
  takeProfitPrice: number;
  potentialProfit: number;
  riskReward: number;
  leverageNeeded: number;
}

export default function RiskCalculator() {
  const { ticker } = useTickerStore();
  const { balance: globalBalance, setBalance: setGlobalBalance } = useBalanceStore();
  const [balance, setBalance] = useState(globalBalance.toString());
  const [risk, setRisk] = useState('1');
  const [entry, setEntry] = useState(ticker ? ticker.price.toFixed(2) : '95000');
  const [stop, setStop] = useState('');
  const [rr, setRR] = useState('2');
  const [result, setResult] = useState<RiskResult | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const calculate = async () => {
    setError('');
    const entryNum = parseFloat(entry);
    const stopNum = parseFloat(stop);
    if (!entryNum || !stopNum) {
      setError('Enter entry and stop-loss prices');
      return;
    }
    setLoading(true);
    try {
      const res = await calculateRisk({
        accountBalance: parseFloat(balance),
        riskPercent: parseFloat(risk),
        entryPrice: entryNum,
        stopLossPrice: stopNum,
        rrRatio: parseFloat(rr),
      });
      setResult(res);
    } catch {
      setError('Calculation failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-3 h-full overflow-y-auto">
      <div className="text-sm font-semibold text-text mb-3">Position Calculator</div>

      <div className="grid grid-cols-2 gap-2 mb-3">
        <div>
          <label className="text-[10px] text-muted block mb-1">Balance (USDT)</label>
          <input
            value={balance}
            onChange={e => { setBalance(e.target.value); const v = parseFloat(e.target.value); if (!isNaN(v) && v > 0) setGlobalBalance(v); }}
            className="w-full bg-bg border border-border rounded px-2 py-1 text-xs text-text focus:border-accent outline-none"
          />
        </div>
        <div>
          <label className="text-[10px] text-muted block mb-1">Risk %</label>
          <input
            value={risk}
            onChange={e => setRisk(e.target.value)}
            className="w-full bg-bg border border-border rounded px-2 py-1 text-xs text-text focus:border-accent outline-none"
          />
        </div>
        <div>
          <label className="text-[10px] text-muted block mb-1">Entry Price</label>
          <input
            value={entry}
            onChange={e => setEntry(e.target.value)}
            placeholder={ticker ? ticker.price.toFixed(2) : ''}
            className="w-full bg-bg border border-border rounded px-2 py-1 text-xs text-text focus:border-accent outline-none"
          />
        </div>
        <div>
          <label className="text-[10px] text-muted block mb-1">Stop Loss</label>
          <input
            value={stop}
            onChange={e => setStop(e.target.value)}
            className="w-full bg-bg border border-border rounded px-2 py-1 text-xs text-text focus:border-accent outline-none"
          />
        </div>
        <div>
          <label className="text-[10px] text-muted block mb-1">R:R Ratio</label>
          <input
            value={rr}
            onChange={e => setRR(e.target.value)}
            className="w-full bg-bg border border-border rounded px-2 py-1 text-xs text-text focus:border-accent outline-none"
          />
        </div>
        <div className="flex items-end">
          <button
            onClick={calculate}
            disabled={loading}
            className="w-full py-1 text-xs font-semibold bg-accent hover:bg-accent/80 text-white rounded transition-colors"
          >
            {loading ? '...' : 'Calculate'}
          </button>
        </div>
      </div>

      {error && <div className="text-sell text-xs mb-2">{error}</div>}

      {result && (
        <div className="space-y-1.5 text-xs">
          <div className="h-px bg-border mb-2" />
          <div className="flex justify-between">
            <span className="text-muted">Risk Amount:</span>
            <span className="text-sell font-semibold">${fmt(result.riskAmount)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">Position Size:</span>
            <span className="text-text">{fmt(result.positionSizeBTC, 6)} BTC</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">Position Value:</span>
            <span className="text-text">${fmt(result.positionValueUSDT)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">Take Profit:</span>
            <span className="text-buy">${fmt(result.takeProfitPrice)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">Potential Profit:</span>
            <span className="text-buy font-semibold">+${fmt(result.potentialProfit)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">Leverage Needed:</span>
            <span className={`font-semibold ${result.leverageNeeded > 3 ? 'text-sell' : 'text-text'}`}>
              {fmt(result.leverageNeeded, 1)}x
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
