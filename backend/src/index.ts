import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import { initDB } from './config/db';
import pool from './config/db';
import { startBinanceWS, wsEvents, fetchHistoricalCandles } from './services/binanceWs';
import { getCandles } from './services/candleStore';
import { runStrategy } from './services/strategyRunner';
import { getBalance, setBalance, applyPnl } from './services/balanceService';
import { calculateEMA } from './indicators/ema';
import candlesRouter from './routes/candles';
import strategiesRouter from './routes/strategies';
import signalsRouter from './routes/signals';
import statsRouter from './routes/stats';
import { createTradesRouter, rowToTrade } from './routes/trades';
import riskManagementRouter from './routes/riskManagement';
import { Timeframe, Signal, Strategy, Trade } from './types';

const app = express();
const server = http.createServer(app);

const io = new SocketIOServer(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  pingTimeout: 60000,
  pingInterval: 25000,
});

app.use(cors());
app.use(express.json());

app.use('/api/candles', candlesRouter);
app.use('/api/strategies', strategiesRouter);
app.use('/api/signals', signalsRouter);
app.use('/api/stats', statsRouter);
app.use('/api/trades', createTradesRouter(io));
app.use('/api/risk-management', riskManagementRouter);

app.get('/api/ticker', (_req, res) => {
  res.json(currentTicker || {});
});

app.get('/api/balance', async (_req, res) => {
  try {
    res.json({ balance: await getBalance() });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/balance', async (req, res) => {
  try {
    const { balance } = req.body as { balance: number };
    if (!balance || isNaN(Number(balance)) || Number(balance) <= 0) {
      return res.status(400).json({ error: 'balance must be a positive number' });
    }
    const newBalance = await setBalance(Number(balance));
    io.emit('balance:update', newBalance);
    res.json({ balance: newBalance });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

let currentTicker: any = null;

async function getActiveStrategies(): Promise<Strategy[]> {
  const { rows } = await pool.query(`
    SELECT s.id, s.name, s.type, s.timeframe, s.risk_percent, s.leverage, s.enabled, s.params,
           s.risk_management_id,
           rm.name AS rm_name, rm.risk_percent AS rm_risk_percent,
           rm.stop_loss_percent AS rm_stop_loss_percent, rm.take_profit_percent AS rm_take_profit_percent
    FROM strategies s
    LEFT JOIN risk_management rm ON s.risk_management_id = rm.id
    WHERE s.enabled = true
  `);
  return rows.map(r => ({
    id: r.id,
    name: r.name,
    type: r.type,
    timeframe: r.timeframe,
    riskPercent: parseFloat(r.risk_percent),
    leverage: r.leverage || 1,
    enabled: r.enabled,
    params: r.params,
    riskManagementId: r.risk_management_id || null,
    riskManagement: r.risk_management_id ? {
      id: r.risk_management_id,
      name: r.rm_name,
      riskPercent: parseFloat(r.rm_risk_percent),
      stopLossPercent: parseFloat(r.rm_stop_loss_percent),
      takeProfitPercent: parseFloat(r.rm_take_profit_percent),
    } : null,
  }));
}

async function createTrade(signal: Signal, riskPercent: number, leverage: number = 1): Promise<Trade> {
  const balance = await getBalance();
  const riskAmount = parseFloat((balance * riskPercent / 100).toFixed(8));

  const { rows } = await pool.query(
    `INSERT INTO trades
      (signal_id, strategy_id, strategy_name, timeframe, signal_type,
       entry_price, stop_loss, take_profit, confidence, risk_reward, risk_amount, leverage)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     RETURNING *`,
    [
      signal.id ?? null, signal.strategyId, signal.strategyName, signal.timeframe,
      signal.signalType, signal.price, signal.stopLoss, signal.takeProfit,
      signal.confidence, signal.riskReward, riskAmount, leverage,
    ]
  );
  return rowToTrade(rows[0]);
}

async function checkAndCloseTrades(currentPrice: number): Promise<void> {
  const { rows } = await pool.query(`SELECT * FROM trades WHERE status = 'OPEN'`);
  for (const r of rows) {
    const entry = parseFloat(r.entry_price);
    const sl = parseFloat(r.stop_loss);
    const tp = parseFloat(r.take_profit);
    const isBuy = r.signal_type === 'BUY';
    const hitTP = isBuy ? currentPrice >= tp : currentPrice <= tp;
    const hitSL = isBuy ? currentPrice <= sl : currentPrice >= sl;
    if (!hitTP && !hitSL) continue;

    const result = hitTP ? 'WIN' : 'LOSS';
    const pnlPercent = isBuy
      ? ((currentPrice - entry) / entry) * 100
      : ((entry - currentPrice) / entry) * 100;

    const riskAmount = r.risk_amount ? parseFloat(r.risk_amount) : 0;
    const leverage = r.leverage || 1;
    const stopDist = Math.abs(entry - sl);
    const positionSizeBtc = stopDist > 0 ? (riskAmount / stopDist) * leverage : 0;
    const pnlUsd = positionSizeBtc * Math.abs(currentPrice - entry) * (hitTP ? 1 : -1);

    const { rows: [updated] } = await pool.query(
      `UPDATE trades
       SET exit_price = $1, status = 'CLOSED', result = $2, pnl_percent = $3, pnl_usd = $4, closed_at = NOW()
       WHERE id = $5 RETURNING *`,
      [currentPrice, result, pnlPercent.toFixed(4), pnlUsd.toFixed(8), r.id]
    );

    if (riskAmount > 0) {
      const newBalance = await applyPnl(pnlUsd);
      io.emit('balance:update', newBalance);
    }

    io.emit('trade:update', rowToTrade(updated));
  }
}

async function saveSignal(signal: Signal): Promise<Signal> {
  const { rows } = await pool.query(
    `INSERT INTO signals
      (strategy_id, strategy_name, strategy_type, timeframe, signal_type, price, ema25, rsi,
       confidence, strength, stop_loss, take_profit, risk_reward, atr)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
     RETURNING id, created_at`,
    [
      signal.strategyId, signal.strategyName, signal.strategyType,
      signal.timeframe, signal.signalType, signal.price, signal.ema25,
      signal.rsi || null, signal.confidence, signal.strength,
      signal.stopLoss, signal.takeProfit, signal.riskReward, signal.atr,
    ]
  );
  return { ...signal, id: rows[0].id, createdAt: rows[0].created_at };
}

wsEvents.on('candle', ({ timeframe, candle }) => {
  const closes = getCandles(timeframe as Timeframe, 1000).map(c => c.close);
  const ema25arr = calculateEMA(closes, 25);
  const currentEMA = ema25arr[ema25arr.length - 1];

  io.emit('candle:update', {
    timeframe,
    candle,
    ema25: currentEMA || null,
  });
});

wsEvents.on('candle:closed', async ({ timeframe }) => {
  try {
    const strategies = await getActiveStrategies();
    const relevantStrategies = strategies.filter(s => s.timeframe === timeframe);
    if (relevantStrategies.length === 0) return;

    const candles = getCandles(timeframe as Timeframe, 1000);
    if (candles.length < 50) return;

    for (const strategy of relevantStrategies) {
      const rawSignal = runStrategy(strategy, candles);
      if (!rawSignal || rawSignal.confidence < 50) continue;

      let signal = rawSignal;
      let effectiveRisk = strategy.riskPercent;

      if (strategy.riskManagement) {
        const rm = strategy.riskManagement;
        const isBuy = rawSignal.signalType === 'BUY';
        const slPrice = isBuy
          ? rawSignal.price * (1 - rm.stopLossPercent / 100)
          : rawSignal.price * (1 + rm.stopLossPercent / 100);
        const tpPrice = isBuy
          ? rawSignal.price * (1 + rm.takeProfitPercent / 100)
          : rawSignal.price * (1 - rm.takeProfitPercent / 100);
        const rrRatio = parseFloat((Math.abs(tpPrice - rawSignal.price) / Math.abs(rawSignal.price - slPrice)).toFixed(2));
        signal = { ...rawSignal, stopLoss: slPrice, takeProfit: tpPrice, riskReward: rrRatio };
        effectiveRisk = rm.riskPercent;
      }

      const saved = await saveSignal(signal);
      io.emit('signal:new', saved);
      console.log(`[${timeframe}] ${signal.signalType} @ ${signal.price.toFixed(2)} (${signal.confidence}% conf, ${effectiveRisk}% risk${strategy.riskManagement ? ' [RM: ' + strategy.riskManagement.name + ']' : ''})`);
      const trade = await createTrade(saved, effectiveRisk, strategy.leverage);
      io.emit('trade:new', trade);
    }
  } catch (err: any) {
    console.error('Strategy runner error:', err.message);
  }
});

wsEvents.on('ticker', (ticker) => {
  currentTicker = ticker;
  io.emit('ticker:update', ticker);
  checkAndCloseTrades(ticker.price).catch(err =>
    console.error('checkAndCloseTrades error:', err.message)
  );
});

wsEvents.on('orderbook', (ob) => {
  io.emit('orderbook:update', ob);
});

io.on('connection', async (socket) => {
  console.log('Client connected:', socket.id);
  if (currentTicker) socket.emit('ticker:update', currentTicker);

  try {
    const [openResult, closedResult, balance] = await Promise.all([
      pool.query(`SELECT * FROM trades WHERE status = 'OPEN' ORDER BY opened_at DESC`),
      pool.query(`SELECT * FROM trades WHERE status = 'CLOSED' ORDER BY closed_at DESC LIMIT 100`),
      getBalance(),
    ]);

    socket.emit('trades:open', openResult.rows.map(rowToTrade));
    socket.emit('trades:closed', closedResult.rows.map(rowToTrade));
    socket.emit('balance:update', balance);
  } catch (err: any) {
    console.error('Error sending initial data on connect:', err.message);
  }

  socket.on('subscribe:timeframe', async (timeframe: Timeframe) => {
    let candles = getCandles(timeframe, 1000);
    if (candles.length === 0) {
      try {
        candles = await fetchHistoricalCandles(timeframe, 1000);
      } catch (e: any) {
        console.error(`Failed to fetch candles for ${timeframe}:`, e.message);
      }
    }
    const closes = candles.map(c => c.close);
    const ema25 = calculateEMA(closes, 25);
    socket.emit('candles:history', {
      timeframe,
      candles,
      ema25: ema25.map((v, i) => ({
        time: Math.floor(candles[i].openTime / 1000),
        value: v > 0 ? parseFloat(v.toFixed(2)) : null,
      })).filter(p => p.value !== null),
    });
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

const PORT = parseInt(process.env.PORT || '3001', 10);

async function main() {
  await initDB();
  await startBinanceWS();
  server.listen(PORT, '127.0.0.1', () => {
    console.log(`Bitcoin Terminal API running on port ${PORT}`);
  });
}

main().catch(console.error);
