import { useEffect, useState } from 'react';
import { useStrategyStore } from '../store';
import { fetchStrategies, updateStrategy } from '../services/api';
import { Strategy } from '../types';

const STRATEGY_LABELS: Record<string, string> = {
  EMA25_CROSSOVER: 'EMA25 Crossover',
  EMA25_BOUNCE: 'EMA25 Bounce',
  EMA25_RSI: 'EMA25 + RSI',
  EMA25_BOUNCE_1M: 'EMA25 Bounce 1m',
};

const LEVERAGE_PRESETS = [1, 2, 3, 5, 10, 20, 50, 100];

function StrategyRow({
  strategy,
  onToggle,
  onLeverageChange,
}: {
  strategy: Strategy;
  onToggle: (id: number, enabled: boolean) => void;
  onLeverageChange: (id: number, leverage: number) => void;
}) {
  const [toggling, setToggling] = useState(false);
  const [showLeverage, setShowLeverage] = useState(false);
  const [savingLeverage, setSavingLeverage] = useState(false);

  const toggle = async () => {
    if (!strategy.id) return;
    setToggling(true);
    try {
      await onToggle(strategy.id, !strategy.enabled);
    } finally {
      setToggling(false);
    }
  };

  const handleLeverageSelect = async (lev: number) => {
    if (!strategy.id || lev === strategy.leverage) {
      setShowLeverage(false);
      return;
    }
    setSavingLeverage(true);
    setShowLeverage(false);
    try {
      await onLeverageChange(strategy.id, lev);
    } finally {
      setSavingLeverage(false);
    }
  };

  const leverage = strategy.leverage ?? 1;

  return (
    <div className={`p-3 rounded-lg border transition-all ${strategy.enabled ? 'border-border' : 'border-border/30 opacity-50'}`}>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm font-medium text-text">{strategy.name}</span>
        <button
          onClick={toggle}
          disabled={toggling}
          className={`relative w-10 h-5 rounded-full transition-colors ${strategy.enabled ? 'bg-buy' : 'bg-border'} ${toggling ? 'opacity-50' : ''}`}
        >
          <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${strategy.enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
        </button>
      </div>

      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent/20 text-accent">
          {STRATEGY_LABELS[strategy.type] || strategy.type}
        </span>
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-border/60 text-muted">{strategy.timeframe}</span>
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-border/60 text-muted">Risk {strategy.riskPercent}%</span>

        <button
          onClick={() => setShowLeverage(v => !v)}
          disabled={savingLeverage}
          className={`text-[10px] px-1.5 py-0.5 rounded font-semibold transition-colors border ${
            leverage > 1
              ? 'bg-ema/15 border-ema/40 text-ema hover:bg-ema/25'
              : 'bg-border/40 border-border text-muted hover:text-text hover:border-text/30'
          } ${savingLeverage ? 'opacity-50' : ''}`}
        >
          {savingLeverage ? '...' : `×${leverage}`}
        </button>
      </div>

      {showLeverage && (
        <div className="mt-2 p-2 rounded-lg bg-panel/80 border border-border/60">
          <div className="text-[10px] text-muted mb-1.5 font-medium">Плечо</div>
          <div className="flex flex-wrap gap-1">
            {LEVERAGE_PRESETS.map(lev => (
              <button
                key={lev}
                onClick={() => handleLeverageSelect(lev)}
                className={`text-[11px] px-2 py-0.5 rounded font-semibold transition-colors border ${
                  leverage === lev
                    ? 'bg-ema text-black border-ema'
                    : 'border-border text-muted hover:text-text hover:border-text/40 hover:bg-border/40'
                }`}
              >
                ×{lev}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function StrategyPanel() {
  const { strategies, setStrategies, updateStrategy: updateStore } = useStrategyStore();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetchStrategies()
      .then(setStrategies)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleToggle = async (id: number, enabled: boolean) => {
    updateStore(id, { enabled });
    try {
      await updateStrategy(id, { enabled });
    } catch {
      updateStore(id, { enabled: !enabled });
    }
  };

  const handleLeverageChange = async (id: number, leverage: number) => {
    updateStore(id, { leverage });
    try {
      await updateStrategy(id, { leverage });
    } catch {
      const prev = strategies.find(s => s.id === id)?.leverage ?? 1;
      updateStore(id, { leverage: prev });
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b border-border">
        <span className="text-sm font-semibold text-text">Стратегии</span>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {loading ? (
          <div className="text-center text-muted text-xs pt-4 animate-pulse">Загрузка...</div>
        ) : (
          strategies.map(s => (
            <StrategyRow
              key={s.id}
              strategy={s}
              onToggle={handleToggle}
              onLeverageChange={handleLeverageChange}
            />
          ))
        )}
      </div>
    </div>
  );
}
