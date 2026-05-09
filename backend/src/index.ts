import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import { initDB } from './config/db';
import pool from './config/db';
import { startBinanceWS, wsEvents } from './services/binanceWs';
import { getCandles } from './services/candleStore';
import { runStrategy } from './services/strategyRunner';
import { calculateEMA } from './indicators/ema';
import candlesRouter from './routes/candles';
import strategiesRouter from './routes/strategies';
import signalsRouter from './routes/signals';
import statsRouter from './routes/stats';
import tradesRouter, { rowToTrade } from './routes/trades';
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
app.use('/api/trades', tradesRouter);

app.get('/api/ticker', (_req, res) => {
  res.json(currentTicker || {});
});

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

let currentTicker: any = null;

async function getActiveStrategies(): Promise<Strategy[]> {
  const { rows } = await pool.query(
    'SELECT id, name, type, timeframe, risk_percent, enabled, params FROM strategies WHERE enabled = true'
  );
  return rows.map(r => ({
    id: r.id,
    name: r.name,
    type: r.type,
    timeframe: r.timeframe,
    riskPercent: parseFloat(r.risk_percent),
    enabled: r.enabled,
    params: r.params,
  }));
}

async function createTrade(signal: Signal): Promise<Trade> {
  const { rows } = await pool.query(
    `INSERT INTO trades
      (signal_id, strategy_id, strategy_name, timeframe, signal_type,
       entry_price, stop_loss, take_profit, confidence, risk_reward)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
    [
      signal.id ?? null, signal.strategyId, signal.strategyName, signal.timeframe,
      signal.signalType, signal.price, signal.stopLoss, signal.takeProfit,
      signal.confidence, signal.riskReward,
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

    const { rows: [updated] } = await pool.query(
      `UPDATE trades
       SET exit_price = $1, status = 'CLOSED', result = $2, pnl_percent = $3, closed_at = NOW()
       WHERE id = $4 RETURNING *`,
      [currentPrice, result, pnlPercent.toFixed(4), r.id]
    );
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

wsEvents.on('candle', ({ timeframe, candle, wasClosed }) => {
  const closes = getCandles(timeframe as Timeframe, 1000).map(c => c.close);
  const ema25arr = calculateEMA(closes, 25);
  const currentEMA = ema25arr[ema25arr.length - 1];

  io.emit('candle:update', {
    timeframe,
    candle,
    ema25: currentEMA || null,
  });
});

wsEvents.on('candle:closed', async ({ timeframe, candle }) => {
  try {
    const strategies = await getActiveStrategies();
    const relevantStrategies = strategies.filter(s => s.timeframe === timeframe);
    if (relevantStrategies.length === 0) return;

    const candles = getCandles(timeframe as Timeframe, 1000);
    if (candles.length < 50) return;

    for (const strategy of relevantStrategies) {
      const signal = runStrategy(strategy, candles);
      if (signal && signal.confidence >= 50) {
        const saved = await saveSignal(signal);
        io.emit('signal:new', saved);
        console.log(`[${timeframe}] ${signal.signalType} signal @ ${signal.price.toFixed(2)} (${signal.confidence}% confidence)`);
        const trade = await createTrade(saved);
        io.emit('trade:new', trade);
      }
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
    const { rows: openRows } = await pool.query(
      `SELECT * FROM trades WHERE status = 'OPEN' ORDER BY opened_at DESC`
    );
    socket.emit('trades:open', openRows.map(rowToTrade));

    const { rows: closedRows } = await pool.query(
      `SELECT * FROM trades WHERE status = 'CLOSED' ORDER BY closed_at DESC LIMIT 100`
    );
    socket.emit('trades:closed', closedRows.map(rowToTrade));
  } catch (err: any) {
    console.error('Error sending trades on connect:', err.message);
  }

  socket.on('subscribe:timeframe', (timeframe: Timeframe) => {
    const candles = getCandles(timeframe, 1000);
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
