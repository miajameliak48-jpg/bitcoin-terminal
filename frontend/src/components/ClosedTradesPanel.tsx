import { useState } from 'react';
import { useTradeStore } from '../store';
import { Trade } from '../types';

function fmt(n: number) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(dateStr?: string | null): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleString('ru-RU', {
    day: '2-digit', month: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

type Filter = 'all' | 'win' | 'loss';

function Summary({ trades }: { trades: Trade[] }) {
  if (trades.length === 0) return null;
  const wins = trades.filter(t => t.result === 'WIN').length;
  const losses = trades.filter(t => t.result === 'LOSS').length;
  const winRate = trades.length > 0 ? (wins / trades.length) * 100 : 0;
  const totalPnlUsd = trades.reduce((sum, t) => sum + (t.pnlUsd ?? 0), 0);
  const hasUsd = trades.some(t => t.pnlUsd != null);

  return (
    <div className="px-3 py-2 border-b border-border bg-panel/50 grid grid-cols-3 gap-2 text-center shrink-0">
      <div>
        <div className="text-xs text-muted">Винрейт</div>
        <div className={`text-sm font-bold ${winRate >= 50 ? 'text-buy' : 'text-sell'}`}>{winRate.toFixed(0)}%</div>
      </div>
      <div>
        <div className="text-xs text-muted">P&L</div>
        {hasUsd ? (
          <div className={`text-sm font-bold tabular-nums ${totalPnlUsd >= 0 ? 'text-buy' : 'text-sell'}`}>
            {totalPnlUsd >= 0 ? '+' : ''}{totalPnlUsd.toFixed(2)}$
          </div>
        ) : (
          <div className="text-sm font-bold text-muted">—</div>
        )}
      </div>
      <div>
        <div className="text-xs text-muted">W / L</div>
        <div className="text-sm font-bold">
          <span className="text-buy">{wins}</span>
          <span className="text-muted"> / </span>
          <span className="text-sell">{losses}</span>
        </div>
      </div>
    </div>
  );
}

function TradeRow({ trade }: { trade: Trade }) {
  const isBuy = trade.signalType === 'BUY';
  const isWin = trade.result === 'WIN';
  const pnl = trade.pnlPercent ?? 0;
  const pnlUsd = trade.pnlUsd ?? null;

  return (
    <div className={`p-3 rounded-lg border ${isWin ? 'border-buy/20 bg-buy/5' : 'border-sell/20 bg-sell/5'}`}>
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${isBuy ? 'bg-buy/20 text-buy' : 'bg-sell/20 text-sell'}`}>
            {isBuy ? '▲ BUY' : '▼ SELL'}
          </span>
          <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${isWin ? 'bg-buy/20 text-buy' : 'bg-sell/20 text-sell'}`}>
            {isWin ? 'WIN' : 'LOSS'}
          </span>
          <span className="text-xs text-muted">{trade.timeframe}</span>
        </div>
        <div className="text-right">
          <div className={`text-sm font-bold tabular-nums ${pnl >= 0 ? 'text-buy' : 'text-sell'}`}>
            {pnl >= 0 ? '+' : ''}{pnl.toFixed(2)}%
          </div>
          {pnlUsd !== null && (
            <div className={`text-[10px] tabular-nums ${pnlUsd >= 0 ? 'text-buy/70' : 'text-sell/70'}`}>
              {pnlUsd >= 0 ? '+' : ''}{pnlUsd.toFixed(2)}$
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs">
        <span className="text-muted">Вход: <span className="text-text tabular-nums">${fmt(trade.entryPrice)}</span></span>
        <span className="text-muted">Выход: <span className="text-text tabular-nums">${fmt(trade.exitPrice ?? 0)}</span></span>
        <span className="text-muted">RR: <span className="text-text">1:{trade.riskReward}</span></span>
        <span className="text-muted">Закрыта: <span className="text-text">{fmtDate(trade.closedAt)}</span></span>
      </div>

      {trade.riskAmount && (
        <div className="mt-1 text-xs text-muted">Риск: <span className="text-sell tabular-nums">${fmt(trade.riskAmount)}</span></div>
      )}
      <div className="mt-1 text-xs text-muted truncate">{trade.strategyName}</div>
    </div>
  );
}

export default function ClosedTradesPanel() {
  const { closedTrades } = useTradeStore();
  const [filter, setFilter] = useState<Filter>('all');

  const filtered = closedTrades.filter(t => {
    if (filter === 'win') return t.result === 'WIN';
    if (filter === 'loss') return t.result === 'LOSS';
    return true;
  });

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b border-border flex items-center justify-between shrink-0">
        <span className="text-sm font-semibold text-text">Закрытые сделки</span>
        <span className="text-xs text-muted">{closedTrades.length} всего</span>
      </div>

      <Summary trades={closedTrades} />

      {/* Filter bar */}
      <div className="flex border-b border-border shrink-0">
        {(['all', 'win', 'loss'] as Filter[]).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`flex-1 py-1.5 text-xs font-medium transition-colors ${
              filter === f ? 'text-text border-b-2 border-accent' : 'text-muted hover:text-text'
            }`}
          >
            {f === 'all' ? 'Все' : f === 'win' ? 'WIN' : 'LOSS'}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto space-y-2 p-2">
        {filtered.length === 0 ? (
          <div className="text-center text-muted text-xs pt-8">
            <div className="text-2xl mb-2">📋</div>
            <div>Нет закрытых сделок</div>
            <div className="mt-1 opacity-60">Сделки закрываются при достижении SL или TP</div>
          </div>
        ) : (
          filtered.map((t, i) => <TradeRow key={t.id ?? i} trade={t} />)
        )}
      </div>
    </div>
  );
}
