import { useRef, useState } from 'react';
import { useTickerStore, useBalanceStore } from '../store';
import { syncBalance } from '../services/api';

function fmt(n: number, d = 2) {
  return n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
}

function BalanceWidget() {
  const { balance, setBalance } = useBalanceStore();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  function startEdit() {
    setDraft(balance.toString());
    setEditing(true);
    setTimeout(() => inputRef.current?.select(), 0);
  }

  function commit() {
    const val = parseFloat(draft.replace(/,/g, ''));
    if (!isNaN(val) && val > 0) {
      setBalance(val);
      syncBalance(val).catch(console.error);
    }
    setEditing(false);
  }

  return (
    <div className="flex items-center gap-1.5 border-l border-border pl-3">
      <span className="text-xs text-muted">Баланс:</span>
      {editing ? (
        <input
          ref={inputRef}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); }}
          className="w-24 bg-bg border border-accent rounded px-1.5 py-0.5 text-xs text-text outline-none tabular-nums"
        />
      ) : (
        <button
          onClick={startEdit}
          className="text-xs text-text font-semibold tabular-nums hover:text-accent transition-colors"
          title="Нажмите для изменения баланса"
        >
          ${fmt(balance)}
        </button>
      )}
    </div>
  );
}

export default function Header() {
  const { ticker } = useTickerStore();
  const isUp = (ticker?.priceChangePercent ?? 0) >= 0;

  return (
    <header className="flex items-center gap-6 px-4 py-2 bg-panel border-b border-border shrink-0">
      <div className="flex items-center gap-2">
        <span className="text-ema font-bold text-lg">₿</span>
        <span className="text-text font-semibold">BTC/USDT</span>
      </div>

      {ticker ? (
        <>
          <span className={`text-2xl font-bold tabular-nums ${isUp ? 'text-buy' : 'text-sell'}`}>
            ${fmt(ticker.price)}
          </span>
          <span className={`text-sm ${isUp ? 'text-buy' : 'text-sell'}`}>
            {isUp ? '▲' : '▼'} {isUp ? '+' : ''}{fmt(ticker.priceChange)} ({isUp ? '+' : ''}{fmt(ticker.priceChangePercent)}%)
          </span>
          <div className="hidden md:flex items-center gap-4 text-xs text-muted ml-4">
            <span>H: <span className="text-text">${fmt(ticker.high24h)}</span></span>
            <span>L: <span className="text-text">${fmt(ticker.low24h)}</span></span>
            <span>Vol: <span className="text-text">{fmt(ticker.volume24h, 2)} BTC</span></span>
          </div>
        </>
      ) : (
        <span className="text-muted animate-pulse">Connecting...</span>
      )}

      <div className="ml-auto flex items-center gap-4">
        <BalanceWidget />
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-buy animate-pulse" />
          <span className="text-xs text-muted">Live</span>
        </div>
      </div>
    </header>
  );
}
