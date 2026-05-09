import { useEffect, useState } from 'react';
import Header from './components/Header';
import TradingChart from './components/TradingChart';
import SignalPanel from './components/SignalPanel';
import OrderBook from './components/OrderBook';
import StrategyPanel from './components/StrategyPanel';
import RiskCalculator from './components/RiskCalculator';
import { useChartStore } from './store';
import { useSocket } from './hooks/useSocket';
import { fetchSignals } from './services/api';
import { useSignalStore } from './store';
import { Timeframe } from './types';

const TIMEFRAMES: Timeframe[] = ['1m', '5m', '15m', '1h', '4h'];
type Tab = 'signals' | 'strategies' | 'risk';

export default function App() {
  const { timeframe, setTimeframe } = useChartStore();
  const { setSignals } = useSignalStore();
  const [tab, setTab] = useState<Tab>('signals');

  useSocket();

  useEffect(() => {
    fetchSignals(50).then(setSignals).catch(console.error);
  }, []);

  return (
    <div className="flex flex-col h-screen bg-bg text-text overflow-hidden">
      <Header />

      {/* Timeframe selector */}
      <div className="flex items-center gap-1 px-3 py-1.5 bg-panel border-b border-border shrink-0">
        {TIMEFRAMES.map(tf => (
          <button
            key={tf}
            onClick={() => setTimeframe(tf)}
            className={`px-2.5 py-1 text-xs rounded font-medium transition-colors ${
              timeframe === tf
                ? 'bg-accent text-white'
                : 'text-muted hover:text-text hover:bg-border/50'
            }`}
          >
            {tf}
          </button>
        ))}
        <div className="ml-3 text-xs text-muted border-l border-border pl-3">
          EMA<span className="text-ema font-bold">25</span>
        </div>
      </div>

      {/* Main layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Chart */}
        <div className="flex-1 overflow-hidden">
          <TradingChart />
        </div>

        {/* Right sidebar */}
        <div className="w-72 flex flex-col border-l border-border shrink-0 overflow-hidden">
          {/* Tab bar */}
          <div className="flex border-b border-border shrink-0">
            {(['signals', 'strategies', 'risk'] as Tab[]).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 py-2 text-xs font-medium capitalize transition-colors ${
                  tab === t ? 'text-text border-b-2 border-accent' : 'text-muted hover:text-text'
                }`}
              >
                {t === 'risk' ? 'Risk Calc' : t}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-hidden">
            {tab === 'signals' && <SignalPanel />}
            {tab === 'strategies' && <StrategyPanel />}
            {tab === 'risk' && <RiskCalculator />}
          </div>
        </div>
      </div>
    </div>
  );
}
