import { useEffect, useRef, useState } from 'react';
import Header from './components/Header';
import TradingChart from './components/TradingChart';
import EMAOscillator from './components/EMAOscillator';
import SignalPanel from './components/SignalPanel';
import OrderBook from './components/OrderBook';
import StrategyPanel from './components/StrategyPanel';
import RiskCalculator from './components/RiskCalculator';
import OpenTradesPanel, { OpenTradeModal } from './components/OpenTradesPanel';
import ClosedTradesPanel from './components/ClosedTradesPanel';
import StatsPage from './pages/StatsPage';
import { useChartStore, useTradeStore } from './store';
import { useSocket } from './hooks/useSocket';
import { fetchSignals } from './services/api';
import { useSignalStore } from './store';
import { Timeframe } from './types';

const DEFAULT_TIMEFRAMES: Timeframe[] = ['1m', '5m', '15m', '1h', '4h', '1d'];
const VALID_TIMEFRAMES: Timeframe[] = ['1s','1m','3m','5m','15m','30m','1h','2h','4h','6h','8h','12h','1d','3d','1w','1M'];

type SideTab = 'signals' | 'strategies' | 'risk' | 'open' | 'closed';
type Page = 'terminal' | 'stats';

const SIDE_TABS: { key: SideTab; label: string }[] = [
  { key: 'signals', label: 'Сигналы' },
  { key: 'open', label: 'Открытые' },
  { key: 'closed', label: 'Закрытые' },
  { key: 'strategies', label: 'Стратег.' },
  { key: 'risk', label: 'Риск' },
];

function loadCustomTFs(): Timeframe[] {
  try { return JSON.parse(localStorage.getItem('btc_custom_tfs') || '[]'); }
  catch { return []; }
}

export default function App() {
  const { timeframe, setTimeframe } = useChartStore();
  const { setSignals } = useSignalStore();
  const { openTrades } = useTradeStore();
  const [sideTab, setSideTab] = useState<SideTab>('signals');
  const [page, setPage] = useState<Page>('terminal');
  const [showOscillator, setShowOscillator] = useState(false);
  const [tradeModal, setTradeModal] = useState<'BUY' | 'SELL' | null>(null);
  const [customTFs, setCustomTFs] = useState<Timeframe[]>(loadCustomTFs);
  const [addingTF, setAddingTF] = useState(false);
  const [newTFInput, setNewTFInput] = useState('');
  const [tfError, setTfError] = useState('');
  const tfInputRef = useRef<HTMLInputElement>(null);

  const allShownTFs = [...DEFAULT_TIMEFRAMES, ...customTFs];

  function handleAddTF() {
    const val = newTFInput.trim() as Timeframe;
    if (!VALID_TIMEFRAMES.includes(val)) {
      setTfError(`Допустимые: ${VALID_TIMEFRAMES.join(', ')}`);
      return;
    }
    if (allShownTFs.includes(val)) {
      setTfError('Уже добавлен');
      return;
    }
    const updated = [...customTFs, val];
    setCustomTFs(updated);
    localStorage.setItem('btc_custom_tfs', JSON.stringify(updated));
    setNewTFInput('');
    setAddingTF(false);
    setTfError('');
    setTimeframe(val);
  }

  function removeCustomTF(tf: Timeframe) {
    const updated = customTFs.filter(t => t !== tf);
    setCustomTFs(updated);
    localStorage.setItem('btc_custom_tfs', JSON.stringify(updated));
    if (timeframe === tf) setTimeframe('15m');
  }

  useEffect(() => {
    if (addingTF) tfInputRef.current?.focus();
  }, [addingTF]);

  useSocket();

  useEffect(() => {
    fetchSignals(50).then(setSignals).catch(console.error);
  }, []);

  return (
    <div className="flex flex-col h-screen bg-bg text-text overflow-hidden">
      <Header />

      {/* Top nav bar */}
      <div className="flex items-center gap-1 px-3 py-1.5 bg-panel border-b border-border shrink-0 overflow-x-auto">
        {/* Page switcher */}
        <button
          onClick={() => setPage('terminal')}
          className={`px-3 py-1 text-xs rounded font-medium transition-colors mr-2 ${
            page === 'terminal' ? 'bg-accent text-white' : 'text-muted hover:text-text hover:bg-border/50'
          }`}
        >
          Терминал
        </button>
        <button
          onClick={() => setPage('stats')}
          className={`px-3 py-1 text-xs rounded font-medium transition-colors mr-4 ${
            page === 'stats' ? 'bg-accent text-white' : 'text-muted hover:text-text hover:bg-border/50'
          }`}
        >
          Статистика
        </button>

        {/* Timeframes — visible only on terminal page */}
        {page === 'terminal' && (
          <>
            <div className="w-px h-4 bg-border mx-1 shrink-0" />

            {/* Default timeframes */}
            {DEFAULT_TIMEFRAMES.map(tf => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={`px-2.5 py-1 text-xs rounded font-medium transition-colors shrink-0 ${
                  timeframe === tf ? 'bg-border text-text' : 'text-muted hover:text-text hover:bg-border/50'
                }`}
              >
                {tf}
              </button>
            ))}

            {/* Custom timeframes with remove button */}
            {customTFs.map(tf => (
              <div key={tf} className="relative group shrink-0 flex items-center">
                <button
                  onClick={() => setTimeframe(tf)}
                  className={`pl-2.5 pr-5 py-1 text-xs rounded font-medium transition-colors ${
                    timeframe === tf ? 'bg-accent/20 text-accent' : 'text-muted hover:text-text hover:bg-border/50'
                  }`}
                >
                  {tf}
                </button>
                <button
                  onClick={() => removeCustomTF(tf)}
                  className="absolute right-0.5 top-1/2 -translate-y-1/2 text-[10px] text-muted opacity-0 group-hover:opacity-100 hover:text-sell transition-all leading-none px-0.5"
                  title="Удалить"
                >
                  ×
                </button>
              </div>
            ))}

            {/* Add custom TF */}
            {addingTF ? (
              <div className="flex items-center gap-1 shrink-0">
                <div className="flex flex-col">
                  <input
                    ref={tfInputRef}
                    value={newTFInput}
                    onChange={e => { setNewTFInput(e.target.value); setTfError(''); }}
                    onKeyDown={e => { if (e.key === 'Enter') handleAddTF(); if (e.key === 'Escape') { setAddingTF(false); setTfError(''); } }}
                    placeholder="напр. 2h"
                    className="w-14 bg-bg border border-accent rounded px-1.5 py-0.5 text-xs text-text outline-none tabular-nums"
                  />
                  {tfError && (
                    <span className="absolute mt-6 text-[9px] text-sell bg-panel border border-border rounded px-1.5 py-1 z-10 w-max max-w-48 whitespace-normal leading-tight">
                      {tfError}
                    </span>
                  )}
                </div>
                <button onClick={handleAddTF} className="text-xs text-buy hover:text-buy/80 font-bold px-1">✓</button>
                <button onClick={() => { setAddingTF(false); setTfError(''); setNewTFInput(''); }} className="text-xs text-muted hover:text-sell px-1">✕</button>
              </div>
            ) : (
              <button
                onClick={() => setAddingTF(true)}
                title="Добавить таймфрейм"
                className="shrink-0 px-1.5 py-0.5 text-xs text-muted hover:text-text hover:bg-border/50 rounded transition-colors font-bold"
              >
                +
              </button>
            )}

            <div className="ml-3 text-xs text-muted border-l border-border pl-3 flex items-center gap-2 shrink-0">
              EMA<span className="text-ema font-bold">25</span>
              <button
                onClick={() => setShowOscillator(v => !v)}
                className={`ml-1 px-2 py-0.5 rounded text-xs font-medium transition-colors border ${
                  showOscillator
                    ? 'bg-ema/20 border-ema text-ema'
                    : 'border-border text-muted hover:text-text hover:border-text/40'
                }`}
              >
                ~ Осциллятор
              </button>
            </div>

            <div className="ml-auto flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => setTradeModal('BUY')}
                className="px-3 py-1 text-xs font-bold rounded bg-buy hover:bg-buy/80 text-white transition-colors"
              >
                ▲ BUY
              </button>
              <button
                onClick={() => setTradeModal('SELL')}
                className="px-3 py-1 text-xs font-bold rounded bg-sell hover:bg-sell/80 text-white transition-colors"
              >
                ▼ SELL
              </button>
            </div>
          </>
        )}
      </div>

      {/* Page content */}
      {page === 'stats' ? (
        <StatsPage />
      ) : (
        <div className="flex flex-1 overflow-hidden">
          {/* Chart + oscillator */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className={`overflow-hidden ${showOscillator ? 'flex-[3]' : 'flex-1'} min-h-0`}>
              <TradingChart />
            </div>
            {showOscillator && (
              <div className="flex-[1] flex flex-col border-t border-border min-h-0">
                <div className="flex items-center gap-3 px-3 py-1 bg-panel border-b border-border shrink-0">
                  <span className="text-xs text-muted font-medium">EMA25 Отклонение</span>
                  <span className="text-xs text-green-400">▲ выше EMA</span>
                  <span className="text-xs text-red-400">▼ ниже EMA</span>
                </div>
                <div className="flex-1 overflow-hidden">
                  <EMAOscillator />
                </div>
              </div>
            )}
          </div>

          {/* Right sidebar */}
          <div className="w-72 flex flex-col border-l border-border shrink-0 overflow-hidden">
            <div className="flex border-b border-border shrink-0 overflow-x-auto">
              {SIDE_TABS.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setSideTab(key)}
                  className={`relative shrink-0 flex-1 py-2 text-xs font-medium transition-colors whitespace-nowrap px-1 ${
                    sideTab === key ? 'text-text border-b-2 border-accent' : 'text-muted hover:text-text'
                  }`}
                >
                  {label}
                  {key === 'open' && openTrades.length > 0 && (
                    <span className="ml-1 bg-accent text-white text-[10px] rounded-full px-1 leading-none">
                      {openTrades.length}
                    </span>
                  )}
                </button>
              ))}
            </div>
            <div className="flex-1 overflow-hidden">
              {sideTab === 'signals' && <SignalPanel />}
              {sideTab === 'open' && <OpenTradesPanel />}
              {sideTab === 'closed' && <ClosedTradesPanel />}
              {sideTab === 'strategies' && <StrategyPanel />}
              {sideTab === 'risk' && <RiskCalculator />}
            </div>
          </div>
        </div>
      )}

      {tradeModal && (
        <OpenTradeModal defaultSide={tradeModal} onClose={() => setTradeModal(null)} />
      )}
    </div>
  );
}
