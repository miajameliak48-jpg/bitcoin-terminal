import { useEffect, useState } from 'react';
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

const TIMEFRAMES: Timeframe[] = ['1m', '5m', '15m', '1h', '4h'];
type SideTab = 'signals' | 'strategies' | 'risk' | 'open' | 'closed';
type Page = 'terminal' | 'stats';

const SIDE_TABS: { key: SideTab; label: string }[] = [
  { key: 'signals', label: 'Сигналы' },
  { key: 'open', label: 'Открытые' },
  { key: 'closed', label: 'Закрытые' },
  { key: 'strategies', label: 'Стратег.' },
  { key: 'risk', label: 'Риск' },
];

export default function App() {
  const { timeframe, setTimeframe } = useChartStore();
  const { setSignals } = useSignalStore();
  const { openTrades } = useTradeStore();
  const [sideTab, setSideTab] = useState<SideTab>('signals');
  const [page, setPage] = useState<Page>('terminal');
  const [showOscillator, setShowOscillator] = useState(false);
  const [tradeModal, setTradeModal] = useState<'BUY' | 'SELL' | null>(null);

  useSocket();

  useEffect(() => {
    fetchSignals(50).then(setSignals).catch(console.error);
  }, []);

  return (
    <div className="flex flex-col h-screen bg-bg text-text overflow-hidden">
      <Header />

      {/* Top nav bar */}
      <div className="flex items-center gap-1 px-3 py-1.5 bg-panel border-b border-border shrink-0">
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
            <div className="w-px h-4 bg-border mx-1" />
            {TIMEFRAMES.map(tf => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={`px-2.5 py-1 text-xs rounded font-medium transition-colors ${
                  timeframe === tf
                    ? 'bg-border text-text'
                    : 'text-muted hover:text-text hover:bg-border/50'
                }`}
              >
                {tf}
              </button>
            ))}
            <div className="ml-3 text-xs text-muted border-l border-border pl-3 flex items-center gap-2">
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

            <div className="ml-auto flex items-center gap-1.5">
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
