import WebSocket from 'ws';
import { Candle, Timeframe } from '../types';
import { updateCandle } from './candleStore';
import { EventEmitter } from 'events';

export const wsEvents = new EventEmitter();

const BINANCE_WS_BASE = 'wss://stream.binance.com:9443/stream';
const SYMBOL = 'btcusdt';
const TIMEFRAMES: Timeframe[] = ['1m', '3m', '5m', '15m', '30m', '1h', '2h', '4h', '6h', '12h', '1d'];

let ws: WebSocket | null = null;
let reconnectDelay = 1000;
let reconnectTimer: NodeJS.Timeout | null = null;

function buildStreams(): string {
  const klineStreams = TIMEFRAMES.map(tf => `${SYMBOL}@kline_${tf}`);
  const extraStreams = [
    `${SYMBOL}@ticker`,
    `${SYMBOL}@depth20@1000ms`,
  ];
  return [...klineStreams, ...extraStreams].join('/');
}

function parseKline(data: any): Candle {
  const k = data.k;
  return {
    openTime: k.t,
    open: parseFloat(k.o),
    high: parseFloat(k.h),
    low: parseFloat(k.l),
    close: parseFloat(k.c),
    volume: parseFloat(k.v),
    closeTime: k.T,
    isClosed: k.x,
  };
}

function handleMessage(raw: string): void {
  try {
    const msg = JSON.parse(raw);
    if (!msg.data || !msg.stream) return;

    const stream: string = msg.stream;
    const data = msg.data;

    if (stream.includes('@kline_')) {
      const tf = stream.split('@kline_')[1] as Timeframe;
      const candle = parseKline(data);
      const { wasClosed } = updateCandle(tf, candle);

      wsEvents.emit('candle', { timeframe: tf, candle, wasClosed });

      if (wasClosed) {
        wsEvents.emit('candle:closed', { timeframe: tf, candle });
      }
    } else if (stream.includes('@ticker')) {
      wsEvents.emit('ticker', {
        symbol: 'BTCUSDT',
        price: parseFloat(data.c),
        priceChange: parseFloat(data.p),
        priceChangePercent: parseFloat(data.P),
        high24h: parseFloat(data.h),
        low24h: parseFloat(data.l),
        volume24h: parseFloat(data.v),
        quoteVolume24h: parseFloat(data.q),
      });
    } else if (stream.includes('@depth')) {
      wsEvents.emit('orderbook', {
        bids: data.bids.slice(0, 15).map((b: string[]) => ({ price: parseFloat(b[0]), quantity: parseFloat(b[1]) })),
        asks: data.asks.slice(0, 15).map((a: string[]) => ({ price: parseFloat(a[0]), quantity: parseFloat(a[1]) })),
        lastUpdateId: data.lastUpdateId,
      });
    }
  } catch {
    // ignore malformed messages
  }
}

export async function fetchHistoricalCandles(timeframe: Timeframe, limit: number = 200): Promise<Candle[]> {
  const url = `https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=${timeframe}&limit=${limit}`;
  const https = require('https');

  return new Promise((resolve, reject) => {
    https.get(url, (res: any) => {
      let data = '';
      res.on('data', (chunk: any) => { data += chunk; });
      res.on('end', () => {
        try {
          const raw = JSON.parse(data);
          const candles: Candle[] = raw.map((k: any[]) => ({
            openTime: k[0],
            open: parseFloat(k[1]),
            high: parseFloat(k[2]),
            low: parseFloat(k[3]),
            close: parseFloat(k[4]),
            volume: parseFloat(k[5]),
            closeTime: k[6],
            isClosed: true,
          }));
          resolve(candles);
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

function connect(): void {
  const url = `${BINANCE_WS_BASE}?streams=${buildStreams()}`;
  ws = new WebSocket(url);

  ws.on('open', () => {
    console.log('Binance WebSocket connected');
    reconnectDelay = 1000;
  });

  ws.on('message', (data: Buffer) => {
    handleMessage(data.toString());
  });

  ws.on('ping', (data: Buffer) => {
    ws?.pong(data);
  });

  ws.on('close', () => {
    console.log(`Binance WS closed. Reconnecting in ${reconnectDelay}ms`);
    scheduleReconnect();
  });

  ws.on('error', (err: Error) => {
    console.error('Binance WS error:', err.message);
    ws?.terminate();
  });
}

function scheduleReconnect(): void {
  if (reconnectTimer) clearTimeout(reconnectTimer);
  reconnectTimer = setTimeout(() => {
    reconnectDelay = Math.min(reconnectDelay * 2, 30000);
    connect();
  }, reconnectDelay);
}

// TFs that aren't in the WS stream but should be preloaded on startup
const EXTRA_PRELOAD_TFS: Timeframe[] = ['8h', '3d', '1w', '1M'];

export async function startBinanceWS(): Promise<void> {
  console.log('Loading historical candles...');
  const allPreload = [...TIMEFRAMES, ...EXTRA_PRELOAD_TFS];
  for (const tf of allPreload) {
    try {
      const candles = await fetchHistoricalCandles(tf, 1000);
      const { updateCandle } = await import('./candleStore');
      for (const c of candles) {
        updateCandle(tf, c);
      }
      console.log(`Loaded ${candles.length} candles for ${tf}`);
    } catch (e: any) {
      console.error(`Failed to load ${tf} candles:`, e.message);
    }
  }
  connect();
}
