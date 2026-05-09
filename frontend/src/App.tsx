import { useEffect, useState } from 'react';
import Header from './components/Header';
import TradingChart from './components/TradingChart';
import SignalPanel from './components/SignalPanel';
import OrderBook from './components/OrderBook';
import StrategyPanel from './components/StrategyPanel';
import RiskCalculator from './components/RiskCalculator';
import StatsPage from './pages/StatsPage';
import { useChartStore } from './store';
import { useSocket } from './hooks/useSocket';
import { fetchSignals } from './services/api';
import { useSignalStore } from './store';
import { Timeframe } from './types';

const TIMEFRAMES: Timeframe[] = ['1m', '5m', '15m', '1h', '4h'];
type SideTab = 'signals' | 'strategies' | 'risk';
type Page = 'terminal' | 'stats';

export default function App() {
  const { timeframe, setTimeframe } = useChartStore();
  const { setSignals } = useSignalStore();
  const [sideTab, setSideTab] = useState<SideTab>('signals');
  const [page, setPage] = useState<Page>('terminal');

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
            <div className="ml-3 text-xs text-muted border-l border-border pl-3">
              EMA<span className="text-ema font-bold">25</span>
            </div>
          </>
        )}
      </div>

      {/* Page content */}
      {page === 'stats' ? (
        <StatsPage />
      ) : (
        <div className="flex flex-1 overflow-hidden">
          {/* Chart */}
          <div className="flex-1 overflow-hidden">
            <TradingChart />
          </div>

          {/* Right sidebar */}
          <div className="w-72 flex flex-col border-l border-border shrink-0 overflow-hidden">
            <div className="flex border-b border-border shrink-0">
              {(['signals', 'strategies', 'risk'] as SideTab[]).map(t => (
                <button
                  key={t}
                  onClick={() => setSideTab(t)}
                  className={`flex-1 py-2 text-xs font-medium capitalize transition-colors ${
                    sideTab === t ? 'text-text border-b-2 border-accent' : 'text-muted hover:text-text'
                  }`}
                >
                  {t === 'risk' ? 'Risk Calc' : t}
                </button>
              ))}
            </div>
            <div className="flex-1 overflow-hidden">
              {sideTab === 'signals' && <SignalPanel />}
              {sideTab === 'strategies' && <StrategyPanel />}
              {sideTab === 'risk' && <RiskCalculator />}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
