import { Router, Request, Response } from 'express';
import pool from '../config/db';
import { fetchHistoricalCandles } from '../services/binanceWs';
import { runStrategy } from '../services/strategyRunner';
import { Strategy, Candle, Timeframe } from '../types';

const router = Router();

interface BacktestTrade {
  signal: 'BUY' | 'SELL';
  entry: number;
  sl: number;
  tp: number;
  outcome: 'WIN' | 'LOSS' | 'TIMEOUT';
  pnlPct: number;
  barsHeld: number;
  confidence: number;
}

function runBacktest(strategy: Strategy, candles: Candle[]): BacktestTrade[] {
  const trades: BacktestTrade[] = [];
  const MIN_CANDLES = 50;
  const TIMEOUT_BARS = 50;

  for (let i = MIN_CANDLES; i < candles.length - 1; i++) {
    const slice = candles.slice(0, i + 1);
    const signal = runStrategy(strategy, slice);
    if (!signal || signal.confidence < 50) continue;

    const isBuy = signal.signalType === 'BUY';
    let outcome: 'WIN' | 'LOSS' | 'TIMEOUT' = 'TIMEOUT';
    let barsHeld = 0;

    for (let j = i + 1; j < Math.min(i + 1 + TIMEOUT_BARS, candles.length); j++) {
      const c = candles[j];
      barsHeld = j - i;

      if (isBuy) {
        if (c.high >= signal.takeProfit) { outcome = 'WIN'; break; }
        if (c.low <= signal.stopLoss) { outcome = 'LOSS'; break; }
      } else {
        if (c.low <= signal.takeProfit) { outcome = 'WIN'; break; }
        if (c.high >= signal.stopLoss) { outcome = 'LOSS'; break; }
      }
    }

    const stopDist = Math.abs(signal.price - signal.stopLoss);
    const pnlPct = outcome === 'WIN'
      ? (stopDist * signal.riskReward / signal.price) * 100
      : outcome === 'LOSS'
      ? -(stopDist / signal.price) * 100
      : 0;

    trades.push({
      signal: signal.signalType as 'BUY' | 'SELL',
      entry: signal.price,
      sl: signal.stopLoss,
      tp: signal.takeProfit,
      outcome,
      pnlPct,
      barsHeld,
      confidence: signal.confidence,
    });

    // Skip ahead to avoid overlapping trades
    i += Math.max(barsHeld, 5);
  }

  return trades;
}

function calcBacktestStats(trades: BacktestTrade[]) {
  const completed = trades.filter(t => t.outcome !== 'TIMEOUT');
  const wins = trades.filter(t => t.outcome === 'WIN');
  const losses = trades.filter(t => t.outcome === 'LOSS');

  const grossProfit = wins.reduce((s, t) => s + t.pnlPct, 0);
  const grossLoss = Math.abs(losses.reduce((s, t) => s + t.pnlPct, 0));

  // Max drawdown
  let peak = 0, equity = 0, maxDD = 0;
  for (const t of trades) {
    equity += t.pnlPct;
    if (equity > peak) peak = equity;
    const dd = peak - equity;
    if (dd > maxDD) maxDD = dd;
  }

  // Equity curve (cumulative % per trade)
  let cumulative = 0;
  const equityCurve = trades.map(t => {
    cumulative += t.pnlPct;
    return parseFloat(cumulative.toFixed(4));
  });

  return {
    totalTrades: trades.length,
    completedTrades: completed.length,
    wins: wins.length,
    losses: losses.length,
    timeouts: trades.filter(t => t.outcome === 'TIMEOUT').length,
    winRate: completed.length > 0 ? parseFloat(((wins.length / completed.length) * 100).toFixed(2)) : 0,
    profitFactor: grossLoss > 0 ? parseFloat((grossProfit / grossLoss).toFixed(3)) : grossProfit > 0 ? 999 : 0,
    avgWinPct: wins.length > 0 ? parseFloat((grossProfit / wins.length).toFixed(4)) : 0,
    avgLossPct: losses.length > 0 ? parseFloat((grossLoss / losses.length).toFixed(4)) : 0,
    totalReturnPct: parseFloat((grossProfit - grossLoss).toFixed(4)),
    maxDrawdownPct: parseFloat(maxDD.toFixed(4)),
    avgBarsHeld: completed.length > 0
      ? parseFloat((completed.reduce((s, t) => s + t.barsHeld, 0) / completed.length).toFixed(1))
      : 0,
    avgConfidence: trades.length > 0
      ? parseFloat((trades.reduce((s, t) => s + t.confidence, 0) / trades.length).toFixed(1))
      : 0,
    equityCurve,
    buySignals: trades.filter(t => t.signal === 'BUY').length,
    sellSignals: trades.filter(t => t.signal === 'SELL').length,
  };
}

// GET /api/stats — overview of all strategies
router.get('/', async (_req: Request, res: Response) => {
  try {
    const { rows: strategies } = await pool.query(
      'SELECT id, name, type, timeframe, risk_percent, enabled, params FROM strategies ORDER BY id'
    );

    const { rows: signalCounts } = await pool.query(`
      SELECT strategy_id,
        COUNT(*) AS total,
        SUM(CASE WHEN signal_type='BUY' THEN 1 ELSE 0 END) AS buys,
        SUM(CASE WHEN signal_type='SELL' THEN 1 ELSE 0 END) AS sells,
        ROUND(AVG(confidence)::numeric, 1) AS avg_confidence,
        ROUND(AVG(risk_reward)::numeric, 3) AS avg_rr,
        MAX(created_at) AS last_signal
      FROM signals
      GROUP BY strategy_id
    `);

    const countMap = new Map(signalCounts.map(r => [r.strategy_id, r]));

    const result = strategies.map((s: any) => {
      const sc = countMap.get(s.id) || {};
      return {
        id: s.id,
        name: s.name,
        type: s.type,
        timeframe: s.timeframe,
        riskPercent: parseFloat(s.risk_percent),
        enabled: s.enabled,
        signals: {
          total: parseInt(sc.total || '0'),
          buys: parseInt(sc.buys || '0'),
          sells: parseInt(sc.sells || '0'),
          avgConfidence: parseFloat(sc.avg_confidence || '0'),
          avgRR: parseFloat(sc.avg_rr || '0'),
          lastSignal: sc.last_signal || null,
        },
      };
    });

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/stats/:id — detailed stats + backtest for one strategy
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);

    const { rows } = await pool.query(
      'SELECT id, name, type, timeframe, risk_percent, enabled, params FROM strategies WHERE id = $1',
      [id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Strategy not found' });

    const strategy: Strategy = {
      id: rows[0].id,
      name: rows[0].name,
      type: rows[0].type,
      timeframe: rows[0].timeframe,
      riskPercent: parseFloat(rows[0].risk_percent),
      enabled: rows[0].enabled,
      params: rows[0].params,
    };

    // Live signal stats
    const { rows: signalRows } = await pool.query(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN signal_type='BUY' THEN 1 ELSE 0 END) AS buys,
        SUM(CASE WHEN signal_type='SELL' THEN 1 ELSE 0 END) AS sells,
        SUM(CASE WHEN strength='HIGH' THEN 1 ELSE 0 END) AS high_count,
        SUM(CASE WHEN strength='MEDIUM' THEN 1 ELSE 0 END) AS medium_count,
        SUM(CASE WHEN strength='LOW' THEN 1 ELSE 0 END) AS low_count,
        ROUND(AVG(confidence)::numeric, 1) AS avg_confidence,
        ROUND(AVG(risk_reward)::numeric, 3) AS avg_rr,
        ROUND(AVG(atr)::numeric, 2) AS avg_atr,
        MAX(created_at) AS last_signal,
        MIN(created_at) AS first_signal
      FROM signals WHERE strategy_id = $1
    `, [id]);

    // Signals per day (last 14 days)
    const { rows: dailyRows } = await pool.query(`
      SELECT DATE(created_at) AS day, COUNT(*) AS count
      FROM signals
      WHERE strategy_id = $1 AND created_at > NOW() - INTERVAL '14 days'
      GROUP BY day ORDER BY day
    `, [id]);

    // Recent signals (last 20)
    const { rows: recentRows } = await pool.query(`
      SELECT signal_type, price, confidence, strength, stop_loss, take_profit,
             risk_reward, rsi, ema25, created_at
      FROM signals WHERE strategy_id = $1
      ORDER BY created_at DESC LIMIT 20
    `, [id]);

    const sc = signalRows[0];

    // Run backtest on 300 historical candles
    let backtestStats = null;
    let backtestError = null;
    try {
      const candles = await fetchHistoricalCandles(strategy.timeframe as Timeframe, 300);
      const trades = runBacktest(strategy, candles);
      backtestStats = { ...calcBacktestStats(trades), candlesAnalyzed: candles.length };
    } catch (e: any) {
      backtestError = e.message;
    }

    res.json({
      strategy,
      signals: {
        total: parseInt(sc.total || '0'),
        buys: parseInt(sc.buys || '0'),
        sells: parseInt(sc.sells || '0'),
        byStrength: {
          HIGH: parseInt(sc.high_count || '0'),
          MEDIUM: parseInt(sc.medium_count || '0'),
          LOW: parseInt(sc.low_count || '0'),
        },
        avgConfidence: parseFloat(sc.avg_confidence || '0'),
        avgRR: parseFloat(sc.avg_rr || '0'),
        avgATR: parseFloat(sc.avg_atr || '0'),
        lastSignal: sc.last_signal || null,
        firstSignal: sc.first_signal || null,
        daily: dailyRows.map(r => ({ day: r.day, count: parseInt(r.count) })),
        recent: recentRows.map(r => ({
          signalType: r.signal_type,
          price: parseFloat(r.price),
          confidence: parseFloat(r.confidence),
          strength: r.strength,
          stopLoss: parseFloat(r.stop_loss),
          takeProfit: parseFloat(r.take_profit),
          riskReward: parseFloat(r.risk_reward),
          rsi: r.rsi ? parseFloat(r.rsi) : null,
          ema25: parseFloat(r.ema25),
          createdAt: r.created_at,
        })),
      },
      backtest: backtestStats,
      backtestError,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
