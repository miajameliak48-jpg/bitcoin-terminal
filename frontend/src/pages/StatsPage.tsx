import { useEffect, useState } from 'react';
import axios from 'axios';

const api = axios.create({ baseURL: '/api' });

type StrategyType = 'EMA25_CROSSOVER' | 'EMA25_BOUNCE' | 'EMA25_RSI';

const STRATEGY_LABELS: Record<StrategyType, string> = {
  EMA25_CROSSOVER: 'EMA25 Crossover',
  EMA25_BOUNCE: 'EMA25 Bounce',
  EMA25_RSI: 'EMA25 + RSI',
};

const STRATEGY_GLOW: Record<string, string> = {
  EMA25_CROSSOVER:  'shadow-glow-accent',
  EMA25_BOUNCE:     'shadow-glow-buy',
  EMA25_RSI:        'shadow-glow-ema',
  EMA25_BOUNCE_1M:  'shadow-glow-buy',
};

const STRATEGY_DESC: Record<StrategyType, string> = {
  EMA25_CROSSOVER: 'Сигнал при пересечении EMA25 ценой с подтверждением объёмом',
  EMA25_BOUNCE: 'Отскок от EMA25 как динамической поддержки/сопротивления',
  EMA25_RSI: 'Вход по RSI откату в тренде, определённом EMA25',
};

function fmt(n: number, d = 2) {
  return n?.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }) ?? '—';
}

function fmtPct(n: number) {
  const sign = n > 0 ? '+' : '';
  return `${sign}${fmt(n, 2)}%`;
}

function timeAgo(dateStr?: string | null): string {
  if (!dateStr) return 'нет сигналов';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'только что';
  if (mins < 60) return `${mins} мин назад`;
  if (mins < 1440) return `${Math.floor(mins / 60)} ч назад`;
  return `${Math.floor(mins / 1440)} д назад`;
}

interface StrategySummary {
  id: number;
  name: string;
  type: string;
  timeframe: string;
  riskPercent: number;
  enabled: boolean;
  signals: {
    total: number;
    buys: number;
    sells: number;
    avgConfidence: number;
    avgRR: number;
    lastSignal: string | null;
  };
}

interface SignalItem {
  signalType: string;
  price: number;
  confidence: number;
  strength: string;
  stopLoss: number;
  takeProfit: number;
  riskReward: number;
  rsi: number | null;
  ema25: number;
  createdAt: string;
}

interface StrategyDetail {
  strategy: { id: number; name: string; type: string; timeframe: string; riskPercent: number; enabled: boolean };
  signals: {
    total: number;
    buys: number;
    sells: number;
    byStrength: { HIGH: number; MEDIUM: number; LOW: number };
    avgConfidence: number;
    avgRR: number;
    avgATR: number;
    lastSignal: string | null;
    firstSignal: string | null;
    daily: { day: string; count: number }[];
    recent: SignalItem[];
  };
  backtest: {
    totalTrades: number;
    completedTrades: number;
    wins: number;
    losses: number;
    timeouts: number;
    winRate: number;
    profitFactor: number;
    avgWinPct: number;
    avgLossPct: number;
    totalReturnPct: number;
    maxDrawdownPct: number;
    avgBarsHeld: number;
    avgConfidence: number;
    equityCurve: number[];
    buySignals: number;
    sellSignals: number;
    candlesAnalyzed: number;
  } | null;
  backtestError: string | null;
}

// Mini bar chart for daily signals
function DailyChart({ data }: { data: { day: string; count: number }[] }) {
  if (!data.length) return <div className="text-muted text-xs text-center py-4">Нет данных</div>;
  const max = Math.max(...data.map(d => d.count), 1);
  return (
    <div className="flex items-end gap-0.5 h-16">
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-0.5 group relative">
          <div
            className="w-full bg-accent/60 hover:bg-accent rounded-t transition-all"
            style={{ height: `${(d.count / max) * 100}%` }}
          />
          <div className="absolute bottom-full mb-1 hidden group-hover:flex bg-panel border border-border rounded px-1.5 py-0.5 text-[10px] whitespace-nowrap z-10">
            {new Date(d.day).toLocaleDateString('ru', { day: 'numeric', month: 'short' })}: {d.count}
          </div>
        </div>
      ))}
    </div>
  );
}

// Mini equity curve
function EquityCurve({ data }: { data: number[] }) {
  if (!data.length) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const W = 300, H = 80;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * W;
    const y = H - ((v - min) / range) * (H - 4) - 2;
    return `${x},${y}`;
  }).join(' ');
  const lastVal = data[data.length - 1];
  const color = lastVal >= 0 ? '#3fb950' : '#f85149';

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-20">
      <defs>
        <linearGradient id="eq-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* Zero line */}
      {min < 0 && max > 0 && (
        <line
          x1="0" x2={W}
          y1={H - ((0 - min) / range) * (H - 4) - 2}
          y2={H - ((0 - min) / range) * (H - 4) - 2}
          stroke="#30363d" strokeDasharray="3,3"
        />
      )}
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" />
    </svg>
  );
}

// Stat card
function StatBox({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="bg-bg rounded-lg p-3 border border-border">
      <div className="text-[10px] text-muted uppercase tracking-wide mb-1">{label}</div>
      <div className={`text-xl font-bold tabular-nums ${color || 'text-text'}`}>{value}</div>
      {sub && <div className="text-[10px] text-muted mt-0.5">{sub}</div>}
    </div>
  );
}

function WinRateRing({ winRate }: { winRate: number }) {
  const r = 30, cx = 40, cy = 40;
  const circ = 2 * Math.PI * r;
  const fill = (winRate / 100) * circ;
  const color = winRate >= 55 ? '#3fb950' : winRate >= 45 ? '#ff9500' : '#f85149';
  return (
    <svg width="80" height="80">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#30363d" strokeWidth="6" />
      <circle
        cx={cx} cy={cy} r={r} fill="none"
        stroke={color} strokeWidth="6"
        strokeDasharray={`${fill} ${circ}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${cx} ${cy})`}
      />
      <text x={cx} y={cy + 1} textAnchor="middle" dominantBaseline="middle" fill={color} fontSize="13" fontWeight="bold">
        {winRate.toFixed(0)}%
      </text>
    </svg>
  );
}

function DetailModal({ strategyId, onClose }: { strategyId: number; onClose: () => void }) {
  const [data, setData] = useState<StrategyDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<StrategyDetail>(`/stats/${strategyId}`)
      .then(r => setData(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [strategyId]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4" onClick={onClose}>
      <div
        className="relative bg-panel border border-border rounded-xl w-full max-w-3xl my-4 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          {data && (
            <div>
              <h2 className="text-lg font-bold text-text">{data.strategy.name}</h2>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs px-1.5 py-0.5 rounded bg-accent/20 text-accent">
                  {STRATEGY_LABELS[data.strategy.type as StrategyType] || data.strategy.type}
                </span>
                <span className="text-xs text-muted">{data.strategy.timeframe}</span>
                <span className={`text-xs ${data.strategy.enabled ? 'text-buy' : 'text-muted'}`}>
                  {data.strategy.enabled ? '● активна' : '○ выключена'}
                </span>
              </div>
            </div>
          )}
          <button onClick={onClose} className="text-muted hover:text-text text-xl leading-none">×</button>
        </div>

        {loading ? (
          <div className="py-16 text-center text-muted animate-pulse">Загрузка данных и бэктест...</div>
        ) : data ? (
          <div className="p-5 space-y-6">

            {/* Signal stats */}
            <section>
              <h3 className="text-sm font-semibold text-muted uppercase tracking-wide mb-3">Живые сигналы</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
                <StatBox label="Всего сигналов" value={String(data.signals.total)} />
                <StatBox label="BUY / SELL" value={`${data.signals.buys} / ${data.signals.sells}`} />
                <StatBox label="Ср. уверенность" value={`${data.signals.avgConfidence}%`}
                  color={data.signals.avgConfidence >= 70 ? 'text-buy' : 'text-ema'} />
                <StatBox label="Ср. Risk/Reward" value={`1:${fmt(data.signals.avgRR, 2)}`} />
              </div>

              {/* Strength distribution */}
              <div className="bg-bg rounded-lg p-3 border border-border mb-4">
                <div className="text-[10px] text-muted mb-2 uppercase tracking-wide">Распределение по силе сигнала</div>
                <div className="space-y-1.5">
                  {(['HIGH', 'MEDIUM', 'LOW'] as const).map(s => {
                    const count = data.signals.byStrength[s];
                    const pct = data.signals.total > 0 ? (count / data.signals.total) * 100 : 0;
                    const color = s === 'HIGH' ? 'bg-buy' : s === 'MEDIUM' ? 'bg-ema' : 'bg-border';
                    return (
                      <div key={s} className="flex items-center gap-2">
                        <span className="text-[10px] text-muted w-14">{s}</span>
                        <div className="flex-1 h-2 bg-border rounded-full overflow-hidden">
                          <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-[10px] text-text w-8 text-right">{count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Daily chart */}
              <div className="bg-bg rounded-lg p-3 border border-border">
                <div className="text-[10px] text-muted mb-2 uppercase tracking-wide">Сигналы по дням (14 дней)</div>
                <DailyChart data={data.signals.daily} />
                {data.signals.daily.length === 0 && (
                  <div className="text-xs text-muted text-center">Сигналы появятся по мере работы стратегии</div>
                )}
              </div>
            </section>

            {/* Backtest */}
            <section>
              <h3 className="text-sm font-semibold text-muted uppercase tracking-wide mb-1">
                Бэктест
              </h3>
              <p className="text-[11px] text-muted mb-3">
                {data.backtest ? `На основе ${data.backtest.candlesAnalyzed} свечей ${data.strategy.timeframe}` : ''}
              </p>

              {data.backtestError && !data.backtest && (
                <div className="text-sell text-xs p-3 bg-sell/10 border border-sell/30 rounded">
                  Ошибка бэктеста: {data.backtestError}
                </div>
              )}

              {data.backtest && (
                <>
                  <div className="flex items-center gap-4 mb-4">
                    <WinRateRing winRate={data.backtest.winRate} />
                    <div className="grid grid-cols-2 gap-2 flex-1">
                      <StatBox label="Прибыльных" value={`${data.backtest.wins}`}
                        sub={`из ${data.backtest.completedTrades}`} color="text-buy" />
                      <StatBox label="Убыточных" value={`${data.backtest.losses}`}
                        sub={`таймаутов: ${data.backtest.timeouts}`} color="text-sell" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
                    <StatBox
                      label="Profit Factor"
                      value={data.backtest.profitFactor >= 999 ? '∞' : fmt(data.backtest.profitFactor, 2)}
                      color={data.backtest.profitFactor >= 1.5 ? 'text-buy' : data.backtest.profitFactor >= 1 ? 'text-ema' : 'text-sell'}
                    />
                    <StatBox
                      label="Итог"
                      value={fmtPct(data.backtest.totalReturnPct)}
                      color={data.backtest.totalReturnPct >= 0 ? 'text-buy' : 'text-sell'}
                    />
                    <StatBox
                      label="Ср. выигрыш"
                      value={fmtPct(data.backtest.avgWinPct)}
                      color="text-buy"
                    />
                    <StatBox
                      label="Ср. проигрыш"
                      value={fmtPct(-data.backtest.avgLossPct)}
                      color="text-sell"
                    />
                    <StatBox
                      label="Max Drawdown"
                      value={fmtPct(data.backtest.maxDrawdownPct)}
                      color={data.backtest.maxDrawdownPct > 10 ? 'text-sell' : 'text-ema'}
                    />
                    <StatBox label="BUY / SELL сделок" value={`${data.backtest.buySignals} / ${data.backtest.sellSignals}`} />
                    <StatBox label="Ср. свечей в сделке" value={String(data.backtest.avgBarsHeld)} />
                    <StatBox label="Ср. уверенность" value={`${data.backtest.avgConfidence}%`} />
                  </div>

                  {/* Equity curve */}
                  {data.backtest.equityCurve.length > 1 && (
                    <div className="bg-bg rounded-lg p-3 border border-border">
                      <div className="text-[10px] text-muted mb-2 uppercase tracking-wide">
                        Кривая доходности (накоп. % на сделку)
                      </div>
                      <EquityCurve data={data.backtest.equityCurve} />
                      <div className="flex justify-between text-[10px] text-muted mt-1">
                        <span>Начало</span>
                        <span className={data.backtest.totalReturnPct >= 0 ? 'text-buy' : 'text-sell'}>
                          {fmtPct(data.backtest.totalReturnPct)}
                        </span>
                      </div>
                    </div>
                  )}
                </>
              )}
            </section>

            {/* Recent signals table */}
            {data.signals.recent.length > 0 && (
              <section>
                <h3 className="text-sm font-semibold text-muted uppercase tracking-wide mb-3">Последние сигналы</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-muted border-b border-border">
                        <th className="text-left pb-2">Тип</th>
                        <th className="text-right pb-2">Цена</th>
                        <th className="text-right pb-2">SL</th>
                        <th className="text-right pb-2">TP</th>
                        <th className="text-right pb-2">Conf</th>
                        <th className="text-right pb-2">RSI</th>
                        <th className="text-right pb-2">Время</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {data.signals.recent.map((s, i) => (
                        <tr key={i} className="hover:bg-white/5 transition-colors">
                          <td className="py-1.5">
                            <span className={`font-semibold ${s.signalType === 'BUY' ? 'text-buy' : 'text-sell'}`}>
                              {s.signalType === 'BUY' ? '▲' : '▼'} {s.signalType}
                            </span>
                          </td>
                          <td className="text-right text-text tabular-nums">${fmt(s.price)}</td>
                          <td className="text-right text-sell tabular-nums">${fmt(s.stopLoss)}</td>
                          <td className="text-right text-buy tabular-nums">${fmt(s.takeProfit)}</td>
                          <td className="text-right tabular-nums">
                            <span className={
                              s.confidence >= 80 ? 'text-buy' : s.confidence >= 65 ? 'text-ema' : 'text-muted'
                            }>{s.confidence}%</span>
                          </td>
                          <td className="text-right text-muted tabular-nums">{s.rsi?.toFixed(1) ?? '—'}</td>
                          <td className="text-right text-muted">{timeAgo(s.createdAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </div>
        ) : (
          <div className="py-12 text-center text-sell text-sm">Ошибка загрузки</div>
        )}
      </div>
    </div>
  );
}

export default function StatsPage() {
  const [strategies, setStrategies] = useState<StrategySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  useEffect(() => {
    api.get<StrategySummary[]>('/stats')
      .then(r => setStrategies(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="flex-1 overflow-y-auto p-4 bg-bg">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-xl font-bold text-text mb-1">Статистика стратегий</h1>
        <p className="text-sm text-muted mb-6">
          Сравнение EMA25 стратегий по живым сигналам и бэктесту на исторических данных
        </p>

        {loading ? (
          <div className="text-center text-muted animate-pulse py-12">Загрузка...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {strategies.map(s => {
              const type = s.type as StrategyType;
              return (
                <div
                  key={s.id}
                  className={`bg-panel border border-border rounded-xl p-4 hover:border-accent/50 transition-all cursor-pointer group ${STRATEGY_GLOW[s.type] || ''}`}
                  onClick={() => setSelectedId(s.id)}
                >
                  {/* Top */}
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="text-sm font-semibold text-text group-hover:text-accent transition-colors">
                        {s.name}
                      </h3>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent/20 text-accent">
                          {STRATEGY_LABELS[type] || s.type}
                        </span>
                        <span className="text-[10px] text-muted">{s.timeframe}</span>
                      </div>
                    </div>
                    <span className={`text-[10px] ${s.enabled ? 'text-buy' : 'text-muted'}`}>
                      {s.enabled ? '● ON' : '○ OFF'}
                    </span>
                  </div>

                  {/* Description */}
                  <p className="text-[11px] text-muted mb-3 leading-relaxed">
                    {STRATEGY_DESC[type]}
                  </p>

                  {/* Stats grid */}
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <div className="bg-bg rounded-lg p-2 border border-border/60">
                      <div className="text-[10px] text-muted">Сигналов</div>
                      <div className="text-base font-bold text-text">{s.signals.total}</div>
                      <div className="text-[10px] text-muted">
                        <span className="text-buy">{s.signals.buys}↑</span>
                        {' '}<span className="text-sell">{s.signals.sells}↓</span>
                      </div>
                    </div>
                    <div className="bg-bg rounded-lg p-2 border border-border/60">
                      <div className="text-[10px] text-muted">Уверенность</div>
                      <div className={`text-base font-bold ${
                        s.signals.avgConfidence >= 70 ? 'text-buy' : s.signals.avgConfidence > 0 ? 'text-ema' : 'text-muted'
                      }`}>
                        {s.signals.avgConfidence > 0 ? `${s.signals.avgConfidence}%` : '—'}
                      </div>
                      <div className="text-[10px] text-muted">
                        RR 1:{fmt(s.signals.avgRR, 2)}
                      </div>
                    </div>
                  </div>

                  {/* Last signal */}
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-muted">Последний сигнал:</span>
                    <span className="text-text">{timeAgo(s.signals.lastSignal)}</span>
                  </div>

                  {/* CTA */}
                  <div className="mt-3 pt-3 border-t border-border text-[11px] text-accent group-hover:text-accent/80 text-center">
                    Открыть детали и бэктест →
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {strategies.length === 0 && !loading && (
          <div className="text-center text-muted py-12">Стратегии не найдены</div>
        )}
      </div>

      {selectedId !== null && (
        <DetailModal strategyId={selectedId} onClose={() => setSelectedId(null)} />
      )}
    </div>
  );
}
