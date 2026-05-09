import { Candle, Signal, Strategy, StrategyType, SignalType, SignalStrength } from '../types';
import { calculateEMA, isEMASloping } from '../indicators/ema';
import { calculateRSI } from '../indicators/rsi';
import { calculateATR, calculateVolumeSMA } from '../indicators/atr';

interface StrategyContext {
  candles: Candle[];
  ema25: number[];
  rsi14: number[];
  atr14: number[];
  volumeSma20: number;
}

function buildContext(candles: Candle[]): StrategyContext {
  const closes = candles.map(c => c.close);
  return {
    candles,
    ema25: calculateEMA(closes, 25),
    rsi14: calculateRSI(closes, 14),
    atr14: calculateATR(candles, 14),
    volumeSma20: calculateVolumeSMA(candles, 20),
  };
}

function getStrength(confidence: number): SignalStrength {
  if (confidence >= 85) return 'HIGH';
  if (confidence >= 65) return 'MEDIUM';
  return 'LOW';
}

// --- EMA25 CROSSOVER (15m) ---
// Classic EMA crossover with volume + RSI confirmation.
// Requires 2 of 3 pre-cross candles on the pre-cross side to filter oscillations.
function runCrossoverStrategy(ctx: StrategyContext, strategy: Strategy): Signal | null {
  const { candles, ema25, rsi14, atr14, volumeSma20 } = ctx;
  const n = candles.length;
  if (n < 5) return null;

  const curr = candles[n - 1];
  const prev = candles[n - 2];
  const currEMA = ema25[n - 1];
  const prevEMA = ema25[n - 2];
  const currRSI = rsi14[n - 1];
  const currATR = atr14[n - 1];

  if (!currEMA || !prevEMA || !currRSI || !currATR) return null;

  const params = strategy.params;
  const rrRatio = params.rrRatio || 2;
  const atrMult = params.atrMultiplierSL || 1.5;

  let signalType: SignalType | null = null;
  let confidence = 0;

  const bullishCross = prev.close < prevEMA && curr.close > currEMA;
  const bearishCross = prev.close > prevEMA && curr.close < currEMA;

  // Pre-cross consistency: count how many of the 3 candles before prev were on expected side
  const preCross = candles.slice(n - 5, n - 2);
  const preEMA = ema25.slice(n - 5, n - 2);

  if (bullishCross && currRSI >= 40 && currRSI <= 70) {
    signalType = 'BUY';
    confidence += 40;
    if (currRSI > 45 && currRSI < 65) confidence += 10;
    if (curr.volume > volumeSma20) confidence += 15;
    const emaSlope = isEMASloping(ema25, 5);
    if (emaSlope === 'up') confidence += 15;
    const bodyRatio = Math.abs(curr.close - curr.open) / (curr.high - curr.low || 1);
    if (bodyRatio > 0.6) confidence += 10;
    if (curr.close > prev.high) confidence += 10;
    // Consistency bonus: majority of pre-cross candles were below EMA
    const belowCount = preCross.filter((c, i) => c.close < (preEMA[i] || Infinity)).length;
    if (belowCount >= 2) confidence += 5;
  } else if (bearishCross && currRSI >= 30 && currRSI <= 60) {
    signalType = 'SELL';
    confidence += 40;
    if (currRSI > 35 && currRSI < 55) confidence += 10;
    if (curr.volume > volumeSma20) confidence += 15;
    const emaSlope = isEMASloping(ema25, 5);
    if (emaSlope === 'down') confidence += 15;
    const bodyRatio = Math.abs(curr.close - curr.open) / (curr.high - curr.low || 1);
    if (bodyRatio > 0.6) confidence += 10;
    if (curr.close < prev.low) confidence += 10;
    const aboveCount = preCross.filter((c, i) => c.close > (preEMA[i] || -Infinity)).length;
    if (aboveCount >= 2) confidence += 5;
  }

  if (!signalType || confidence < (params.minConfidence || 55)) return null;

  const stopLoss = signalType === 'BUY'
    ? curr.close - currATR * atrMult
    : curr.close + currATR * atrMult;
  const stopDist = Math.abs(curr.close - stopLoss);
  const takeProfit = signalType === 'BUY'
    ? curr.close + stopDist * rrRatio
    : curr.close - stopDist * rrRatio;

  return {
    strategyId: strategy.id!,
    strategyName: strategy.name,
    strategyType: strategy.type,
    timeframe: strategy.timeframe,
    signalType,
    price: curr.close,
    ema25: currEMA,
    rsi: currRSI,
    confidence,
    strength: getStrength(confidence),
    stopLoss,
    takeProfit,
    riskReward: rrRatio,
    atr: currATR,
  };
}

// --- EMA25 BOUNCE (5m) ---
// Wick-touch bounce: candle wick pierces EMA then closes back on the trend side.
// BUY: low <= EMA, close > EMA, bullish candle  →  EMA acted as support
// SELL: high >= EMA, close < EMA, bearish candle →  EMA acted as resistance
// Also accepts a previous candle bounce confirmed by current continuation.
function runBounceStrategy(ctx: StrategyContext, strategy: Strategy): Signal | null {
  const { candles, ema25, rsi14, atr14 } = ctx;
  const n = candles.length;
  if (n < 6) return null;

  const curr = candles[n - 1];
  const prev = candles[n - 2];
  const currEMA = ema25[n - 1];
  const prevEMA = ema25[n - 2];
  const currRSI = rsi14[n - 1];
  const currATR = atr14[n - 1];

  if (!currEMA || !prevEMA || !currRSI || !currATR) return null;

  const emaSlope = isEMASloping(ema25, 5);
  const params = strategy.params;
  const rrRatio = params.rrRatio || 2;
  const atrMult = params.atrMultiplierSL || 0.3;

  // Wick-touch detection
  const currBullBounce = curr.low <= currEMA && curr.close > currEMA && curr.close > curr.open;
  const prevBullBounce = prev.low <= prevEMA && prev.close > prevEMA && prev.close > prev.open
    && curr.close > currEMA; // current candle confirms the bounce

  const currBearBounce = curr.high >= currEMA && curr.close < currEMA && curr.close < curr.open;
  const prevBearBounce = prev.high >= prevEMA && prev.close < prevEMA && prev.close < prev.open
    && curr.close < currEMA;

  const bullBounce = currBullBounce || prevBullBounce;
  const bearBounce = currBearBounce || prevBearBounce;

  // SL anchored to the actual touching candle's extreme
  const slBullRef = prevBullBounce && !currBullBounce ? prev : curr;
  const slBearRef = prevBearBounce && !currBearBounce ? prev : curr;

  let signalType: SignalType | null = null;
  let confidence = 0;

  if ((emaSlope === 'up' || emaSlope === 'flat') && bullBounce) {
    signalType = 'BUY';
    confidence += 35;
    if (emaSlope === 'up') confidence += 15;
    if (currRSI > 40 && currRSI < 65) confidence += 15;
    const bodyRatio = Math.abs(curr.close - curr.open) / (curr.high - curr.low || 1);
    if (bodyRatio > 0.4) confidence += 15; // meaningful bullish body
    const prevAboveCount = candles.slice(n - 4, n - 1).filter((c, i) => c.close > (ema25[n - 4 + i] || 0)).length;
    if (prevAboveCount >= 2) confidence += 20; // trend context
  } else if ((emaSlope === 'down' || emaSlope === 'flat') && bearBounce) {
    signalType = 'SELL';
    confidence += 35;
    if (emaSlope === 'down') confidence += 15;
    if (currRSI > 35 && currRSI < 60) confidence += 15;
    const bodyRatio = Math.abs(curr.open - curr.close) / (curr.high - curr.low || 1);
    if (bodyRatio > 0.4) confidence += 15; // meaningful bearish body
    const prevBelowCount = candles.slice(n - 4, n - 1).filter((c, i) => c.close < (ema25[n - 4 + i] || Infinity)).length;
    if (prevBelowCount >= 2) confidence += 20; // trend context
  }

  if (!signalType || confidence < (params.minConfidence || 55)) return null;

  const stopLoss = signalType === 'BUY'
    ? slBullRef.low - currATR * atrMult
    : slBearRef.high + currATR * atrMult;
  const stopDist = Math.abs(curr.close - stopLoss);
  if (stopDist === 0) return null;
  const takeProfit = signalType === 'BUY'
    ? curr.close + stopDist * rrRatio
    : curr.close - stopDist * rrRatio;

  return {
    strategyId: strategy.id!,
    strategyName: strategy.name,
    strategyType: strategy.type,
    timeframe: strategy.timeframe,
    signalType,
    price: curr.close,
    ema25: currEMA,
    rsi: currRSI,
    confidence,
    strength: getStrength(confidence),
    stopLoss,
    takeProfit,
    riskReward: rrRatio,
    atr: currATR,
  };
}

// --- EMA25 + RSI (1h) ---
// RSI momentum reversal while price respects EMA25 as trend filter.
// BUY: price above EMA (trend up) + RSI recovering from oversold territory
// SELL: price below EMA (trend down) + RSI retreating from overbought territory
function runRSIStrategy(ctx: StrategyContext, strategy: Strategy): Signal | null {
  const { candles, ema25, rsi14, atr14 } = ctx;
  const n = candles.length;
  if (n < 5) return null;

  const curr = candles[n - 1];
  const currEMA = ema25[n - 1];
  const currRSI = rsi14[n - 1];
  const prevRSI = rsi14[n - 2];
  const currATR = atr14[n - 1];

  if (!currEMA || !currRSI || !prevRSI || !currATR) return null;

  const params = strategy.params;
  const rrRatio = params.rrRatio || 2.5;
  const atrMult = params.atrMultiplierSL || 1.0;
  const rsiOversold = params.rsiOversold || 35;
  const rsiOverbought = params.rsiOverbought || 65;

  const last3AboveEMA = candles.slice(n - 4, n - 1).every((c, i) => c.close > (ema25[n - 4 + i] || 0));
  const last3BelowEMA = candles.slice(n - 4, n - 1).every((c, i) => c.close < (ema25[n - 4 + i] || Infinity));

  let signalType: SignalType | null = null;
  let confidence = 0;

  // BUY: trend up (price above EMA) + RSI recovering from near-oversold
  if (last3AboveEMA && curr.close > currEMA && prevRSI < rsiOversold + 10 && currRSI > prevRSI) {
    signalType = 'BUY';
    confidence += 30;
    if (curr.close > currEMA) confidence += 20;
    if (last3AboveEMA) confidence += 20;
    if (currRSI > prevRSI) confidence += 15;
    if (currRSI < 55) confidence += 15; // RSI has room to run up
  } else if (last3BelowEMA && curr.close < currEMA && prevRSI > rsiOverbought - 10 && currRSI < prevRSI) {
    // SELL: trend down (price below EMA) + RSI retreating from near-overbought
    signalType = 'SELL';
    confidence += 30;
    if (curr.close < currEMA) confidence += 20;
    if (last3BelowEMA) confidence += 20;
    if (currRSI < prevRSI) confidence += 15;
    if (currRSI > 55) confidence += 15; // RSI has room to fall (was previously > 55)
  }

  if (!signalType || confidence < (params.minConfidence || 60)) return null;

  const stopLoss = signalType === 'BUY'
    ? currEMA - currATR * atrMult
    : currEMA + currATR * atrMult;
  const stopDist = Math.abs(curr.close - stopLoss);
  if (stopDist === 0) return null;
  const takeProfit = signalType === 'BUY'
    ? curr.close + stopDist * rrRatio
    : curr.close - stopDist * rrRatio;

  return {
    strategyId: strategy.id!,
    strategyName: strategy.name,
    strategyType: strategy.type,
    timeframe: strategy.timeframe,
    signalType,
    price: curr.close,
    ema25: currEMA,
    rsi: currRSI,
    confidence,
    strength: getStrength(confidence),
    stopLoss,
    takeProfit,
    riskReward: rrRatio,
    atr: currATR,
  };
}

// --- EMA25 BOUNCE 1M ---
// Same wick-touch logic as the 5m bounce but tuned for 1m noise:
// - 3-bar EMA slope (shorter lookback for fast chart)
// - Stricter confidence threshold to filter noise
// - Hammer/shooting star pattern required for full score
function runBounce1mStrategy(ctx: StrategyContext, strategy: Strategy): Signal | null {
  const { candles, ema25, rsi14, atr14, volumeSma20 } = ctx;
  const n = candles.length;
  if (n < 10) return null;

  const curr = candles[n - 1];
  const prev = candles[n - 2];
  const currEMA = ema25[n - 1];
  const prevEMA = ema25[n - 2];
  const currRSI = rsi14[n - 1];
  const currATR = atr14[n - 1];

  if (!currEMA || !prevEMA || !currRSI || !currATR) return null;

  const params = strategy.params;
  const rrRatio = params.rrRatio || 2;
  const atrMult = params.atrMultiplierSL || 0.2;
  const emaSlope = isEMASloping(ema25, 3);

  // Wick-touch bounce (same principle as 5m bounce)
  const currBullBounce = curr.low <= currEMA && curr.close > currEMA && curr.close > curr.open;
  const prevBullBounce = prev.low <= prevEMA && prev.close > prevEMA && prev.close > prev.open
    && curr.close > currEMA;

  const currBearBounce = curr.high >= currEMA && curr.close < currEMA && curr.close < curr.open;
  const prevBearBounce = prev.high >= prevEMA && prev.close < prevEMA && prev.close < prev.open
    && curr.close < currEMA;

  const bullBounce = currBullBounce || prevBullBounce;
  const bearBounce = currBearBounce || prevBearBounce;

  const slBullRef = prevBullBounce && !currBullBounce ? prev : curr;
  const slBearRef = prevBearBounce && !currBearBounce ? prev : curr;

  let signalType: SignalType | null = null;
  let confidence = 0;

  if ((emaSlope === 'up' || emaSlope === 'flat') && bullBounce) {
    signalType = 'BUY';
    confidence += 30;
    if (emaSlope === 'up') confidence += 15;
    if (currRSI > 40 && currRSI < 65) confidence += 15;
    if (curr.volume > volumeSma20) confidence += 15;
    const lowerWick = Math.min(curr.open, curr.close) - curr.low;
    const body = Math.abs(curr.close - curr.open);
    if (body > 0 && lowerWick > body) confidence += 15; // hammer
    const prevAboveEMA = candles.slice(n - 3, n - 1).some((c, i) => c.close > (ema25[n - 3 + i] || 0));
    if (prevAboveEMA) confidence += 10;
  } else if ((emaSlope === 'down' || emaSlope === 'flat') && bearBounce) {
    signalType = 'SELL';
    confidence += 30;
    if (emaSlope === 'down') confidence += 15;
    if (currRSI > 35 && currRSI < 60) confidence += 15;
    if (curr.volume > volumeSma20) confidence += 15;
    const upperWick = curr.high - Math.max(curr.open, curr.close);
    const body = Math.abs(curr.open - curr.close);
    if (body > 0 && upperWick > body) confidence += 15; // shooting star
    const prevBelowEMA = candles.slice(n - 3, n - 1).some((c, i) => c.close < (ema25[n - 3 + i] || Infinity));
    if (prevBelowEMA) confidence += 10;
  }

  if (!signalType || confidence < (params.minConfidence || 65)) return null;

  const stopLoss = signalType === 'BUY'
    ? slBullRef.low - currATR * atrMult
    : slBearRef.high + currATR * atrMult;
  const stopDist = Math.abs(curr.close - stopLoss);
  if (stopDist === 0) return null;
  const takeProfit = signalType === 'BUY'
    ? curr.close + stopDist * rrRatio
    : curr.close - stopDist * rrRatio;

  return {
    strategyId: strategy.id!,
    strategyName: strategy.name,
    strategyType: strategy.type,
    timeframe: strategy.timeframe,
    signalType,
    price: curr.close,
    ema25: currEMA,
    rsi: currRSI,
    confidence,
    strength: getStrength(confidence),
    stopLoss,
    takeProfit,
    riskReward: rrRatio,
    atr: currATR,
  };
}

export function runStrategy(strategy: Strategy, candles: Candle[]): Signal | null {
  if (!strategy.id || candles.length < 50) return null;

  const ctx = buildContext(candles);

  switch (strategy.type) {
    case 'EMA25_CROSSOVER': return runCrossoverStrategy(ctx, strategy);
    case 'EMA25_BOUNCE': return runBounceStrategy(ctx, strategy);
    case 'EMA25_RSI': return runRSIStrategy(ctx, strategy);
    case 'EMA25_BOUNCE_1M': return runBounce1mStrategy(ctx, strategy);
    default: return null;
  }
}

export function calculateRiskParams(
  accountBalance: number,
  riskPercent: number,
  entryPrice: number,
  stopLossPrice: number,
  rrRatio: number
) {
  const riskAmount = accountBalance * riskPercent / 100;
  const stopDistance = Math.abs(entryPrice - stopLossPrice);
  const positionSizeBTC = stopDistance > 0 ? riskAmount / stopDistance : 0;
  const positionValueUSDT = positionSizeBTC * entryPrice;
  const isLong = entryPrice > stopLossPrice;
  const takeProfitPrice = isLong
    ? entryPrice + stopDistance * rrRatio
    : entryPrice - stopDistance * rrRatio;

  return {
    riskAmount,
    positionSizeBTC,
    positionValueUSDT,
    takeProfitPrice,
    potentialProfit: positionSizeBTC * Math.abs(takeProfitPrice - entryPrice),
    riskReward: rrRatio,
    leverageNeeded: positionValueUSDT / accountBalance,
  };
}
