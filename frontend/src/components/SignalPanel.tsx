import { useSignalStore } from '../store';
import { Signal } from '../types';

function fmt(n: number) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function timeAgo(dateStr?: string): string {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
}

function ConfidenceBar({ value }: { value: number }) {
  const color = value >= 85 ? '#3fb950' : value >= 65 ? '#ff9500' : '#8b949e';
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex-1 h-1 bg-border rounded-full overflow-hidden">
        <div style={{ width: `${value}%`, backgroundColor: color }} className="h-full rounded-full transition-all" />
      </div>
      <span className="text-xs tabular-nums" style={{ color }}>{value}%</span>
    </div>
  );
}

function SignalCard({ signal }: { signal: Signal }) {
  const isBuy = signal.signalType === 'BUY';

  return (
    <div className={`p-3 rounded-lg border ${isBuy ? 'border-buy/30 bg-buy/5' : 'border-sell/30 bg-sell/5'}`}>
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${isBuy ? 'bg-buy/20 text-buy' : 'bg-sell/20 text-sell'}`}>
            {isBuy ? '▲ BUY' : '▼ SELL'}
          </span>
          <span className="text-xs text-muted">{signal.timeframe}</span>
        </div>
        <span className="text-xs text-muted">{timeAgo(signal.createdAt)}</span>
      </div>

      <div className="text-base font-bold text-text tabular-nums mb-1">${fmt(signal.price)}</div>

      <ConfidenceBar value={signal.confidence} />

      <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs text-muted">
        <span>SL: <span className="text-sell">${fmt(signal.stopLoss)}</span></span>
        <span>TP: <span className="text-buy">${fmt(signal.takeProfit)}</span></span>
        <span>EMA25: <span className="text-ema">${fmt(signal.ema25)}</span></span>
        <span>RR: <span className="text-text">1:{signal.riskReward}</span></span>
        {signal.rsi && <span>RSI: <span className="text-text">{signal.rsi.toFixed(1)}</span></span>}
      </div>

      <div className="mt-1.5 text-xs text-muted truncate">{signal.strategyName}</div>
    </div>
  );
}

export default function SignalPanel() {
  const { signals } = useSignalStore();

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b border-border flex items-center justify-between">
        <span className="text-sm font-semibold text-text">Signals</span>
        <span className="text-xs text-muted">{signals.length} total</span>
      </div>
      <div className="flex-1 overflow-y-auto space-y-2 p-2">
        {signals.length === 0 ? (
          <div className="text-center text-muted text-xs pt-6">
            <div className="text-2xl mb-2">📡</div>
            Waiting for signals...
          </div>
        ) : (
          signals.slice(0, 20).map((s, i) => <SignalCard key={s.id ?? i} signal={s} />)
        )}
      </div>
    </div>
  );
}
