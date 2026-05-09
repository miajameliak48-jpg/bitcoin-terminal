export function calculateRSI(closes: number[], period: number = 14): number[] {
  if (closes.length < period + 1) return [];

  const result: number[] = new Array(closes.length).fill(0);
  let avgGain = 0;
  let avgLoss = 0;

  for (let i = 1; i <= period; i++) {
    const change = closes[i] - closes[i - 1];
    if (change > 0) avgGain += change;
    else avgLoss += Math.abs(change);
  }

  avgGain /= period;
  avgLoss /= period;

  if (avgLoss === 0) {
    result[period] = 100;
  } else {
    result[period] = 100 - 100 / (1 + avgGain / avgLoss);
  }

  for (let i = period + 1; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1];
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? Math.abs(change) : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;

    if (avgLoss === 0) {
      result[i] = 100;
    } else {
      result[i] = 100 - 100 / (1 + avgGain / avgLoss);
    }
  }

  return result;
}

export function getLastRSI(closes: number[], period: number = 14): number {
  const rsi = calculateRSI(closes, period);
  return rsi[rsi.length - 1] || 50;
}
