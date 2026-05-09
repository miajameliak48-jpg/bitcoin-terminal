import { useEffect, useState } from 'react';
import { useStrategyStore, useRiskManagementStore } from '../store';
import { fetchStrategies, updateStrategy, fetchRiskProfiles, createRiskProfile, deleteRiskProfile } from '../services/api';
import { Strategy, RiskManagement } from '../types';

const STRATEGY_LABELS: Record<string, string> = {
  EMA25_CROSSOVER: 'EMA25 Crossover',
  EMA25_BOUNCE: 'EMA25 Bounce',
  EMA25_RSI: 'EMA25 + RSI',
  EMA25_BOUNCE_1M: 'EMA25 Bounce 1m',
};

const LEVERAGE_PRESETS = [1, 2, 3, 5, 10, 20, 50, 100];

// ─── Strategy Row ────────────────────────────────────────────────────────────

function StrategyRow({
  strategy,
  profiles,
  onToggle,
  onLeverageChange,
  onRMChange,
}: {
  strategy: Strategy;
  profiles: RiskManagement[];
  onToggle: (id: number, enabled: boolean) => void;
  onLeverageChange: (id: number, leverage: number) => void;
  onRMChange: (id: number, rmId: number | null) => void;
}) {
  const [toggling, setToggling] = useState(false);
  const [showLeverage, setShowLeverage] = useState(false);
  const [showRM, setShowRM] = useState(false);
  const [savingLeverage, setSavingLeverage] = useState(false);
  const [savingRM, setSavingRM] = useState(false);

  const leverage = strategy.leverage ?? 1;
  const activeRM = strategy.riskManagement;

  const toggle = async () => {
    if (!strategy.id) return;
    setToggling(true);
    try { await onToggle(strategy.id, !strategy.enabled); }
    finally { setToggling(false); }
  };

  const handleLeverageSelect = async (lev: number) => {
    if (!strategy.id) return;
    setSavingLeverage(true);
    setShowLeverage(false);
    try { await onLeverageChange(strategy.id, lev); }
    finally { setSavingLeverage(false); }
  };

  const handleRMSelect = async (rmId: number | null) => {
    if (!strategy.id) return;
    setSavingRM(true);
    setShowRM(false);
    try { await onRMChange(strategy.id, rmId); }
    finally { setSavingRM(false); }
  };

  return (
    <div className={`p-3 rounded-lg border transition-all ${strategy.enabled ? 'border-border' : 'border-border/30 opacity-50'}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-text">{strategy.name}</span>
        <button
          onClick={toggle}
          disabled={toggling}
          className={`relative w-10 h-5 rounded-full transition-colors shrink-0 ${strategy.enabled ? 'bg-buy' : 'bg-border'} ${toggling ? 'opacity-50' : ''}`}
        >
          <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${strategy.enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
        </button>
      </div>

      {/* Badges row */}
      <div className="flex items-center gap-1 flex-wrap">
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent/20 text-accent">
          {STRATEGY_LABELS[strategy.type] || strategy.type}
        </span>
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-border/60 text-muted">{strategy.timeframe}</span>

        {/* Leverage badge */}
        <button
          onClick={() => { setShowLeverage(v => !v); setShowRM(false); }}
          disabled={savingLeverage}
          className={`text-[10px] px-1.5 py-0.5 rounded font-semibold border transition-colors ${
            leverage > 1
              ? 'bg-ema/15 border-ema/40 text-ema hover:bg-ema/25'
              : 'bg-border/40 border-border text-muted hover:text-text'
          } ${savingLeverage ? 'opacity-50' : ''}`}
        >
          {savingLeverage ? '...' : `×${leverage}`}
        </button>
      </div>

      {/* RM badge row */}
      <div className="mt-1.5">
        <button
          onClick={() => { setShowRM(v => !v); setShowLeverage(false); }}
          disabled={savingRM}
          className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors w-full text-left ${
            activeRM
              ? 'bg-buy/10 border-buy/40 text-buy hover:bg-buy/15'
              : 'bg-border/30 border-border/60 text-muted hover:text-text'
          } ${savingRM ? 'opacity-50' : ''}`}
        >
          {savingRM ? 'Сохранение...' : activeRM
            ? `РМ: ${activeRM.name} · Risk ${activeRM.riskPercent}% · SL ${activeRM.stopLossPercent}% · TP ${activeRM.takeProfitPercent}%`
            : 'РМ: Авто (ATR-based)'}
        </button>
      </div>

      {/* Leverage selector */}
      {showLeverage && (
        <div className="mt-2 p-2 rounded-lg bg-panel border border-border/60">
          <div className="text-[10px] text-muted mb-1.5 font-medium">Кредитное плечо</div>
          <div className="flex flex-wrap gap-1">
            {LEVERAGE_PRESETS.map(lev => (
              <button
                key={lev}
                onClick={() => handleLeverageSelect(lev)}
                className={`text-[11px] px-2 py-0.5 rounded font-semibold border transition-colors ${
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

      {/* RM selector */}
      {showRM && (
        <div className="mt-2 p-2 rounded-lg bg-panel border border-border/60">
          <div className="text-[10px] text-muted mb-1.5 font-medium">Риск-менеджмент</div>
          <div className="space-y-1">
            <button
              onClick={() => handleRMSelect(null)}
              className={`w-full text-left text-[11px] px-2 py-1.5 rounded border transition-colors ${
                !activeRM
                  ? 'bg-accent/20 border-accent text-accent'
                  : 'border-border/50 text-muted hover:text-text hover:bg-border/30'
              }`}
            >
              Авто (ATR-based)
            </button>
            {profiles.map(rm => (
              <button
                key={rm.id}
                onClick={() => handleRMSelect(rm.id!)}
                className={`w-full text-left text-[11px] px-2 py-1.5 rounded border transition-colors ${
                  activeRM?.id === rm.id
                    ? 'bg-buy/15 border-buy/50 text-buy'
                    : 'border-border/50 text-muted hover:text-text hover:bg-border/30'
                }`}
              >
                <div className="font-medium">{rm.name}</div>
                <div className="text-[10px] opacity-70">Risk {rm.riskPercent}% · SL {rm.stopLossPercent}% · TP {rm.takeProfitPercent}%</div>
              </button>
            ))}
            {profiles.length === 0 && (
              <div className="text-[10px] text-muted/60 text-center py-1">
                Нет профилей — создайте в «РМ Профили»
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── RM Profiles Tab ─────────────────────────────────────────────────────────

const EMPTY_FORM = { name: '', riskPercent: '1', stopLossPercent: '2', takeProfitPercent: '4' };

function RMProfilesTab({
  profiles,
  onCreate,
  onDelete,
}: {
  profiles: RiskManagement[];
  onCreate: (p: Omit<RiskManagement, 'id' | 'createdAt'>) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);

  const field = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [key]: e.target.value }));

  const handleCreate = async () => {
    const risk = parseFloat(form.riskPercent);
    const sl = parseFloat(form.stopLossPercent);
    const tp = parseFloat(form.takeProfitPercent);
    if (!form.name.trim() || isNaN(risk) || isNaN(sl) || isNaN(tp)) return;
    setSaving(true);
    try {
      await onCreate({ name: form.name.trim(), riskPercent: risk, stopLossPercent: sl, takeProfitPercent: tp });
      setForm(EMPTY_FORM);
      setShowForm(false);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    setDeleting(id);
    try { await onDelete(id); }
    finally { setDeleting(null); }
  };

  return (
    <div className="flex-1 overflow-y-auto p-2 space-y-2">
      {profiles.length === 0 && !showForm && (
        <div className="text-center text-muted text-xs pt-6 pb-2">Нет профилей</div>
      )}

      {profiles.map(rm => (
        <div key={rm.id} className="p-3 rounded-lg border border-border">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-sm font-medium text-text mb-1">{rm.name}</div>
              <div className="flex gap-2 flex-wrap">
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-sell/15 text-sell border border-sell/30">
                  Risk {rm.riskPercent}%
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-sell/10 text-sell/80 border border-sell/20">
                  SL {rm.stopLossPercent}%
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-buy/10 text-buy border border-buy/20">
                  TP {rm.takeProfitPercent}%
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-border/40 text-muted">
                  RR {(rm.takeProfitPercent / rm.stopLossPercent).toFixed(1)}
                </span>
              </div>
            </div>
            <button
              onClick={() => handleDelete(rm.id!)}
              disabled={deleting === rm.id}
              className="text-muted hover:text-sell text-xs shrink-0 transition-colors disabled:opacity-40"
            >
              {deleting === rm.id ? '...' : '✕'}
            </button>
          </div>
        </div>
      ))}

      {showForm ? (
        <div className="p-3 rounded-lg border border-accent/40 bg-accent/5 space-y-2">
          <div className="text-xs font-medium text-text">Новый профиль</div>

          <input
            placeholder="Название"
            value={form.name}
            onChange={field('name')}
            className="w-full bg-panel border border-border rounded px-2 py-1 text-xs text-text placeholder-muted/60 focus:outline-none focus:border-accent"
          />

          <div className="grid grid-cols-3 gap-1.5">
            {([
              { key: 'riskPercent', label: 'Риск %' },
              { key: 'stopLossPercent', label: 'SL %' },
              { key: 'takeProfitPercent', label: 'TP %' },
            ] as const).map(({ key, label }) => (
              <div key={key}>
                <div className="text-[10px] text-muted mb-0.5">{label}</div>
                <input
                  type="number"
                  min="0.01"
                  step="0.1"
                  value={form[key]}
                  onChange={field(key)}
                  className="w-full bg-panel border border-border rounded px-1.5 py-1 text-xs text-text focus:outline-none focus:border-accent"
                />
              </div>
            ))}
          </div>

          {form.stopLossPercent && form.takeProfitPercent && (
            <div className="text-[10px] text-muted">
              RR: {(parseFloat(form.takeProfitPercent) / parseFloat(form.stopLossPercent)).toFixed(2)}
            </div>
          )}

          <div className="flex gap-1.5 pt-1">
            <button
              onClick={handleCreate}
              disabled={saving || !form.name.trim()}
              className="flex-1 py-1 rounded text-xs font-medium bg-buy hover:bg-buy/80 text-white disabled:opacity-40 transition-colors"
            >
              {saving ? 'Сохранение...' : 'Сохранить'}
            </button>
            <button
              onClick={() => { setShowForm(false); setForm(EMPTY_FORM); }}
              className="px-3 py-1 rounded text-xs text-muted hover:text-text border border-border hover:border-text/30 transition-colors"
            >
              Отмена
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowForm(true)}
          className="w-full py-2 rounded-lg border border-dashed border-border text-muted hover:text-text hover:border-text/40 text-xs transition-colors"
        >
          + Добавить профиль
        </button>
      )}
    </div>
  );
}

// ─── Main Panel ──────────────────────────────────────────────────────────────

type PanelTab = 'strategies' | 'rm';

export default function StrategyPanel() {
  const { strategies, setStrategies, updateStrategy: updateStore } = useStrategyStore();
  const { profiles, setProfiles, addProfile, removeProfile } = useRiskManagementStore();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<PanelTab>('strategies');

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchStrategies(), fetchRiskProfiles()])
      .then(([strats, profs]) => { setStrategies(strats); setProfiles(profs); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleToggle = async (id: number, enabled: boolean) => {
    updateStore(id, { enabled });
    try { await updateStrategy(id, { enabled }); }
    catch { updateStore(id, { enabled: !enabled }); }
  };

  const handleLeverageChange = async (id: number, leverage: number) => {
    const prev = strategies.find(s => s.id === id)?.leverage ?? 1;
    updateStore(id, { leverage });
    try { await updateStrategy(id, { leverage }); }
    catch { updateStore(id, { leverage: prev }); }
  };

  const handleRMChange = async (id: number, rmId: number | null) => {
    const prev = strategies.find(s => s.id === id)?.riskManagementId ?? null;
    const rm = rmId ? profiles.find(p => p.id === rmId) ?? null : null;
    updateStore(id, { riskManagementId: rmId, riskManagement: rm });
    try { await updateStrategy(id, { riskManagementId: rmId } as any); }
    catch {
      const prevRM = prev ? profiles.find(p => p.id === prev) ?? null : null;
      updateStore(id, { riskManagementId: prev, riskManagement: prevRM });
    }
  };

  const handleCreateProfile = async (profile: Omit<RiskManagement, 'id' | 'createdAt'>) => {
    const created = await createRiskProfile(profile);
    addProfile(created);
  };

  const handleDeleteProfile = async (id: number) => {
    await deleteRiskProfile(id);
    removeProfile(id);
    // Clear RM from strategies that used this profile
    strategies.forEach(s => {
      if (s.riskManagementId === id) {
        updateStore(s.id!, { riskManagementId: null, riskManagement: null });
      }
    });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      <div className="flex border-b border-border shrink-0">
        {([
          { key: 'strategies', label: 'Стратегии' },
          { key: 'rm', label: 'РМ Профили' },
        ] as const).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex-1 py-2 text-xs font-medium transition-colors ${
              activeTab === key
                ? 'text-text border-b-2 border-accent'
                : 'text-muted hover:text-text'
            }`}
          >
            {label}
            {key === 'rm' && profiles.length > 0 && (
              <span className="ml-1 bg-border text-muted text-[10px] rounded-full px-1 leading-none">
                {profiles.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <span className="text-muted text-xs animate-pulse">Загрузка...</span>
        </div>
      ) : activeTab === 'strategies' ? (
        <div className="flex-1 overflow-y-auto p-2 space-y-2">
          {strategies.map(s => (
            <StrategyRow
              key={s.id}
              strategy={s}
              profiles={profiles}
              onToggle={handleToggle}
              onLeverageChange={handleLeverageChange}
              onRMChange={handleRMChange}
            />
          ))}
        </div>
      ) : (
        <RMProfilesTab
          profiles={profiles}
          onCreate={handleCreateProfile}
          onDelete={handleDeleteProfile}
        />
      )}
    </div>
  );
}
