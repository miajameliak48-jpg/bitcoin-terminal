import { Candle } from '../types';

export function calculateATR(candles: Candle[], period: number = 14): number[] {
  if (candles.length < period + 1) return [];

  const trueRanges: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const high = candles[i].high;
    const low = candles[i].low;
    const prevClose = candles[i - 1].close;
    trueRanges.push(Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose)));
  }

  const result: number[] = new Array(candles.length).fill(0);
  let atr = trueRanges.slice(0, period).reduce((a, b) => a + b, 0) / period;
  result[period] = atr;

  for (let i = period; i < trueRanges.length; i++) {
    atr = (atr * (period - 1) + trueRanges[i]) / period;
    result[i + 1] = atr;
  }

  return result;
}

export function getLastATR(candles: Candle[], period: number = 14): number {
  const atr = calculateATR(candles, period);
  return atr[atr.length - 1] || 0;
}

export function calculateVolumeSMA(candles: Candle[], period: number = 20): number {
  if (candles.length < period) return 0;
  const recent = candles.slice(-period);
  return recent.reduce((sum, c) => sum + c.volume, 0) / period;
}
