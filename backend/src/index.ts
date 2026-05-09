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
import { Timeframe, Signal, Strategy } from './types';

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
  const closes = getCandles(timeframe as Timeframe, 200).map(c => c.close);
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

    const candles = getCandles(timeframe as Timeframe, 200);
    if (candles.length < 50) return;

    for (const strategy of relevantStrategies) {
      const signal = runStrategy(strategy, candles);
      if (signal && signal.confidence >= 50) {
        const saved = await saveSignal(signal);
        io.emit('signal:new', saved);
        console.log(`[${timeframe}] ${signal.signalType} signal @ ${signal.price.toFixed(2)} (${signal.confidence}% confidence)`);
      }
    }
  } catch (err: any) {
    console.error('Strategy runner error:', err.message);
  }
});

wsEvents.on('ticker', (ticker) => {
  currentTicker = ticker;
  io.emit('ticker:update', ticker);
});

wsEvents.on('orderbook', (ob) => {
  io.emit('orderbook:update', ob);
});

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  if (currentTicker) socket.emit('ticker:update', currentTicker);

  socket.on('subscribe:timeframe', (timeframe: Timeframe) => {
    const candles = getCandles(timeframe, 200);
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
