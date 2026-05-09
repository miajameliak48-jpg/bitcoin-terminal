import { Candle, Timeframe } from '../types';

const BUFFER_SIZE = 1000;

const store = new Map<Timeframe, Candle[]>();

const TIMEFRAMES: Timeframe[] = ['1s', '1m', '3m', '5m', '15m', '30m', '1h', '2h', '4h', '6h', '8h', '12h', '1d', '3d', '1w', '1M'];
for (const tf of TIMEFRAMES) {
  store.set(tf, []);
}

export function updateCandle(timeframe: Timeframe, candle: Candle): { isNew: boolean; wasClosed: boolean } {
  const candles = store.get(timeframe) || [];
  const last = candles[candles.length - 1];

  let isNew = false;
  let wasClosed = false;

  if (!last || last.openTime !== candle.openTime) {
    if (last && !last.isClosed && candle.openTime !== last.openTime) {
      // Previous candle just closed
      candles[candles.length - 1] = { ...last, isClosed: true };
      wasClosed = true;
    }
    candles.push(candle);
    isNew = true;
    if (candles.length > BUFFER_SIZE) candles.shift();
  } else {
    if (!last.isClosed && candle.isClosed) wasClosed = true;
    candles[candles.length - 1] = candle;
  }

  store.set(timeframe, candles);
  return { isNew, wasClosed };
}

export function getCandles(timeframe: Timeframe, limit: number = 200): Candle[] {
  const candles = store.get(timeframe) || [];
  return candles.slice(-limit);
}

export function getLastCandle(timeframe: Timeframe): Candle | undefined {
  const candles = store.get(timeframe) || [];
  return candles[candles.length - 1];
}

export function hasEnoughData(timeframe: Timeframe, minCandles: number = 50): boolean {
  return (store.get(timeframe) || []).length >= minCandles;
}
