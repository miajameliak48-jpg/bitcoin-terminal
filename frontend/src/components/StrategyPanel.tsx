import { useEffect, useState } from 'react';
import { useStrategyStore } from '../store';
import { fetchStrategies, updateStrategy } from '../services/api';
import { Strategy } from '../types';

const STRATEGY_LABELS: Record<string, string> = {
  EMA25_CROSSOVER: 'EMA25 Crossover',
  EMA25_BOUNCE: 'EMA25 Bounce',
  EMA25_RSI: 'EMA25 + RSI',
};

function StrategyRow({ strategy, onToggle }: { strategy: Strategy; onToggle: (id: number, enabled: boolean) => void }) {
  const [loading, setLoading] = useState(false);

  const toggle = async () => {
    if (!strategy.id) return;
    setLoading(true);
    try {
      await onToggle(strategy.id, !strategy.enabled);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`p-3 rounded-lg border transition-all ${strategy.enabled ? 'border-border' : 'border-border/30 opacity-50'}`}>
      <div className="flex items-center justify-between mb-1">
        <div>
          <span className="text-sm font-medium text-text">{strategy.name}</span>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent/20 text-accent">
              {STRATEGY_LABELS[strategy.type] || strategy.type}
            </span>
            <span className="text-[10px] text-muted">{strategy.timeframe}</span>
            <span className="text-[10px] text-muted">Risk: {strategy.riskPercent}%</span>
          </div>
        </div>
        <button
          onClick={toggle}
          disabled={loading}
          className={`relative w-10 h-5 rounded-full transition-colors ${strategy.enabled ? 'bg-buy' : 'bg-border'} ${loading ? 'opacity-50' : ''}`}
        >
          <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${strategy.enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
        </button>
      </div>
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

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b border-border">
        <span className="text-sm font-semibold text-text">Strategies</span>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {loading ? (
          <div className="text-center text-muted text-xs pt-4 animate-pulse">Loading...</div>
        ) : (
          strategies.map(s => (
            <StrategyRow key={s.id} strategy={s} onToggle={handleToggle} />
          ))
        )}
      </div>
    </div>
  );
}
