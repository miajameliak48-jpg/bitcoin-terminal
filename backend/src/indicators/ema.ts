export function calculateEMA(closes: number[], period: number): number[] {
  if (closes.length < period) return [];

  const k = 2 / (period + 1);
  const result: number[] = new Array(closes.length).fill(0);

  // SMA as seed for first EMA value
  let sum = 0;
  for (let i = 0; i < period; i++) sum += closes[i];
  result[period - 1] = sum / period;

  for (let i = period; i < closes.length; i++) {
    result[i] = closes[i] * k + result[i - 1] * (1 - k);
  }

  return result;
}

export function getLastEMA(closes: number[], period: number): number {
  const ema = calculateEMA(closes, period);
  return ema[ema.length - 1] || 0;
}

export function isEMASloping(emaValues: number[], lookback: number = 5): 'up' | 'down' | 'flat' {
  if (emaValues.length < lookback) return 'flat';
  const current = emaValues[emaValues.length - 1];
  const past = emaValues[emaValues.length - lookback];
  const diff = (current - past) / past;
  if (diff > 0.0001) return 'up';
  if (diff < -0.0001) return 'down';
  return 'flat';
}
