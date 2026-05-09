import { useState } from 'react';
import { useTradeStore, useTickerStore } from '../store';
import { closeTrade, openTrade } from '../services/api';
import { Trade } from '../types';

function fmt(n: number) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function timeAgo(dateStr?: string): string {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'только что';
  if (mins < 60) return `${mins}м назад`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}ч назад`;
  return `${Math.floor(hrs / 24)}д назад`;
}

function calcUnrealizedPnl(trade: Trade, currentPrice: number): number {
  const isBuy = trade.signalType === 'BUY';
  return isBuy
    ? ((currentPrice - trade.entryPrice) / trade.entryPrice) * 100
    : ((trade.entryPrice - currentPrice) / trade.entryPrice) * 100;
}

function calcUnrealizedPnlUsd(trade: Trade, currentPrice: number): number | null {
  if (!trade.riskAmount) return null;
  const stopDist = Math.abs(trade.entryPrice - trade.stopLoss);
  if (stopDist === 0) return null;
  const posSizeBtc = trade.riskAmount / stopDist;
  const isBuy = trade.signalType === 'BUY';
  return posSizeBtc * (currentPrice - trade.entryPrice) * (isBuy ? 1 : -1);
}

function PriceProgress({ trade, currentPrice }: { trade: Trade; currentPrice: number }) {
  const isBuy = trade.signalType === 'BUY';
  const range = Math.abs(trade.takeProfit - trade.stopLoss);
  if (range === 0) return null;

  const progress = isBuy
    ? ((currentPrice - trade.stopLoss) / range) * 100
    : ((trade.stopLoss - currentPrice) / range) * 100;
  const clamped = Math.max(0, Math.min(100, progress));
  const color = clamped >= 50 ? '#3fb950' : clamped >= 25 ? '#ff9500' : '#f85149';

  return (
    <div className="mt-1.5">
      <div className="flex justify-between text-xs text-muted mb-0.5">
        <span className="text-sell">SL {fmt(trade.stopLoss)}</span>
        <span className="text-buy">TP {fmt(trade.takeProfit)}</span>
      </div>
      <div className="h-1 bg-border rounded-full overflow-hidden">
        <div style={{ width: `${clamped}%`, backgroundColor: color }} className="h-full rounded-full transition-all duration-500" />
      </div>
    </div>
  );
}

function TradeCard({ trade }: { trade: Trade }) {
  const ticker = useTickerStore(s => s.ticker);
  const { moveToClosed } = useTradeStore();
  const currentPrice = ticker?.price ?? trade.entryPrice;
  const isBuy = trade.signalType === 'BUY';
  const pnl = calcUnrealizedPnl(trade, currentPrice);
  const pnlUsd = calcUnrealizedPnlUsd(trade, currentPrice);
  const isProfit = pnl >= 0;

  async function handleClose() {
    if (!trade.id) return;
    try {
      const closed = await closeTrade(trade.id, currentPrice);
      moveToClosed(closed);
    } catch (e) {
      console.error('Close trade error:', e);
    }
  }

  return (
    <div className={`p-3 rounded-lg border ${isBuy ? 'border-buy/25 bg-buy/5' : 'border-sell/25 bg-sell/5'}`}>
      <div className="flex items-start justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${isBuy ? 'bg-buy/20 text-buy' : 'bg-sell/20 text-sell'}`}>
            {isBuy ? '▲ BUY' : '▼ SELL'}
          </span>
          <span className="text-xs text-muted">{trade.timeframe}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="text-right">
            <div className={`text-sm font-bold tabular-nums ${isProfit ? 'text-buy' : 'text-sell'}`}>
              {isProfit ? '+' : ''}{pnl.toFixed(2)}%
            </div>
            {pnlUsd !== null && (
              <div className={`text-[10px] tabular-nums ${isProfit ? 'text-buy/70' : 'text-sell/70'}`}>
                {pnlUsd >= 0 ? '+' : ''}{pnlUsd.toFixed(2)}$
              </div>
            )}
          </div>
          <button
            onClick={handleClose}
            className="text-xs text-muted hover:text-sell transition-colors px-1.5 py-0.5 rounded hover:bg-sell/10"
            title="Закрыть сделку"
          >
            ✕
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs">
        <span className="text-muted">Вход: <span className="text-text tabular-nums">${fmt(trade.entryPrice)}</span></span>
        <span className="text-muted">Текущая: <span className="text-text tabular-nums">${fmt(currentPrice)}</span></span>
        <span className="text-muted">RR: <span className="text-text">1:{trade.riskReward}</span></span>
        {trade.riskAmount
          ? <span className="text-muted">Риск: <span className="text-sell tabular-nums">${fmt(trade.riskAmount)}</span></span>
          : <span className="text-muted">Уверен.: <span className="text-text">{trade.confidence}%</span></span>
        }
      </div>

      <PriceProgress trade={trade} currentPrice={currentPrice} />

      <div className="mt-1.5 flex items-center justify-between">
        <span className="text-xs text-muted truncate">{trade.strategyName}</span>
        <span className="text-xs text-muted shrink-0 ml-2">{timeAgo(trade.openedAt)}</span>
      </div>
    </div>
  );
}

export function OpenTradeModal({ defaultSide, onClose }: { defaultSide?: 'BUY' | 'SELL'; onClose: () => void }) {
  const ticker = useTickerStore(s => s.ticker);
  const { addTrade } = useTradeStore();
  const [side, setSide] = useState<'BUY' | 'SELL'>(defaultSide ?? 'BUY');
  const [entry, setEntry] = useState(ticker ? ticker.price.toFixed(2) : '');
  const [sl, setSl] = useState('');
  const [tp, setTp] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    setError('');
    const entryNum = parseFloat(entry);
    const slNum = parseFloat(sl);
    const tpNum = parseFloat(tp);

    if (!entryNum || !slNum || !tpNum) {
      setError('Заполните все поля');
      return;
    }
    if (side === 'BUY' && slNum >= entryNum) {
      setError('SL должен быть ниже цены входа');
      return;
    }
    if (side === 'BUY' && tpNum <= entryNum) {
      setError('TP должен быть выше цены входа');
      return;
    }
    if (side === 'SELL' && slNum <= entryNum) {
      setError('SL должен быть выше цены входа');
      return;
    }
    if (side === 'SELL' && tpNum >= entryNum) {
      setError('TP должен быть ниже цены входа');
      return;
    }

    setLoading(true);
    try {
      const trade = await openTrade({ signalType: side, entryPrice: entryNum, stopLoss: slNum, takeProfit: tpNum });
      addTrade(trade);
      onClose();
    } catch {
      setError('Ошибка открытия сделки');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="bg-panel border border-border rounded-xl p-5 w-80 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-semibold text-text">Открыть сделку</span>
          <button onClick={onClose} className="text-muted hover:text-text transition-colors text-lg leading-none">✕</button>
        </div>

        <div className="flex rounded-lg overflow-hidden border border-border mb-4">
          <button
            onClick={() => setSide('BUY')}
            className={`flex-1 py-2 text-sm font-bold transition-colors ${
              side === 'BUY' ? 'bg-buy text-white' : 'text-muted hover:text-buy'
            }`}
          >
            ▲ BUY
          </button>
          <button
            onClick={() => setSide('SELL')}
            className={`flex-1 py-2 text-sm font-bold transition-colors ${
              side === 'SELL' ? 'bg-sell text-white' : 'text-muted hover:text-sell'
            }`}
          >
            ▼ SELL
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-[10px] text-muted block mb-1">Цена входа (USDT)</label>
            <input
              value={entry}
              onChange={e => setEntry(e.target.value)}
              placeholder={ticker ? ticker.price.toFixed(2) : ''}
              className="w-full bg-bg border border-border rounded px-2.5 py-1.5 text-xs text-text focus:border-accent outline-none tabular-nums"
            />
          </div>
          <div>
            <label className="text-[10px] text-muted block mb-1">Стоп-лосс (USDT)</label>
            <input
              value={sl}
              onChange={e => setSl(e.target.value)}
              placeholder={side === 'BUY' ? 'Ниже цены входа' : 'Выше цены входа'}
              className="w-full bg-bg border border-border rounded px-2.5 py-1.5 text-xs text-text focus:border-accent outline-none tabular-nums"
            />
          </div>
          <div>
            <label className="text-[10px] text-muted block mb-1">Тейк-профит (USDT)</label>
            <input
              value={tp}
              onChange={e => setTp(e.target.value)}
              placeholder={side === 'BUY' ? 'Выше цены входа' : 'Ниже цены входа'}
              className="w-full bg-bg border border-border rounded px-2.5 py-1.5 text-xs text-text focus:border-accent outline-none tabular-nums"
            />
          </div>
        </div>

        {entry && sl && tp && (() => {
          const e = parseFloat(entry), s = parseFloat(sl), t = parseFloat(tp);
          if (!isNaN(e) && !isNaN(s) && !isNaN(t) && Math.abs(e - s) > 0) {
            const rr = (Math.abs(t - e) / Math.abs(e - s)).toFixed(2);
            return (
              <div className="mt-3 text-xs text-muted flex justify-between bg-bg rounded px-2.5 py-1.5">
                <span>Risk/Reward</span>
                <span className="text-text font-semibold">1:{rr}</span>
              </div>
            );
          }
          return null;
        })()}

        {error && <div className="mt-2 text-xs text-sell">{error}</div>}

        <button
          onClick={handleSubmit}
          disabled={loading}
          className={`mt-4 w-full py-2 text-sm font-bold rounded-lg transition-colors ${
            side === 'BUY'
              ? 'bg-buy hover:bg-buy/80 text-white'
              : 'bg-sell hover:bg-sell/80 text-white'
          } disabled:opacity-50`}
        >
          {loading ? '...' : `Открыть ${side}`}
        </button>
      </div>
    </div>
  );
}

export default function OpenTradesPanel() {
  const { openTrades } = useTradeStore();
  const [showModal, setShowModal] = useState(false);

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b border-border flex items-center justify-between shrink-0">
        <span className="text-sm font-semibold text-text">Открытые сделки</span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted">{openTrades.length} активных</span>
          <button
            onClick={() => setShowModal(true)}
            className="text-xs font-semibold px-2 py-0.5 rounded bg-accent hover:bg-accent/80 text-white transition-colors"
            title="Открыть сделку вручную"
          >
            + Сделка
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto space-y-2 p-2">
        {openTrades.length === 0 ? (
          <div className="text-center text-muted text-xs pt-8">
            <div className="text-2xl mb-2">📊</div>
            <div>Нет открытых сделок</div>
            <div className="mt-1 opacity-60">Сделки открываются автоматически при сигнале или вручную</div>
          </div>
        ) : (
          openTrades.map((t, i) => <TradeCard key={t.id ?? i} trade={t} />)
        )}
      </div>

      {showModal && <OpenTradeModal onClose={() => setShowModal(false)} />}
    </div>
  );
}
