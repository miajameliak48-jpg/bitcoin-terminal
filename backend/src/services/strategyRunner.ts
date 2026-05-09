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

function runCrossoverStrategy(ctx: StrategyContext, strategy: Strategy): Signal | null {
  const { candles, ema25, rsi14, atr14, volumeSma20 } = ctx;
  const n = candles.length;
  if (n < 3) return null;

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
  }

  if (!signalType || confidence < (params.minConfidence || 50)) return null;

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

function runBounceStrategy(ctx: StrategyContext, strategy: Strategy): Signal | null {
  const { candles, ema25, rsi14, atr14 } = ctx;
  const n = candles.length;
  if (n < 6) return null;

  const curr = candles[n - 1];
  const currEMA = ema25[n - 1];
  const currRSI = rsi14[n - 1];
  const currATR = atr14[n - 1];

  if (!currEMA || !currRSI || !currATR) return null;

  const emaSlope = isEMASloping(ema25, 5);
  const params = strategy.params;
  const rrRatio = params.rrRatio || 2;
  const atrMult = params.atrMultiplierSL || 0.5;

  let signalType: SignalType | null = null;
  let confidence = 0;

  const touchThreshold = 0.001; // 0.1%
  const lowTouchEMA = Math.abs(curr.low - currEMA) / currEMA < touchThreshold;
  const highTouchEMA = Math.abs(curr.high - currEMA) / currEMA < touchThreshold;

  if (emaSlope === 'up' && lowTouchEMA && curr.close > currEMA && curr.close > curr.open) {
    signalType = 'BUY';
    confidence += 35;
    if (currRSI > 40 && currRSI < 65) confidence += 20;
    if (emaSlope === 'up') confidence += 15;
    const pinBarRatio = (curr.close - curr.open) / (curr.high - curr.low || 1);
    if (pinBarRatio > 0.5) confidence += 15;
    const prevClose3 = candles.slice(-4, -1).every(c => c.close > ema25[candles.indexOf(c)]);
    if (prevClose3) confidence += 15;
  } else if (emaSlope === 'down' && highTouchEMA && curr.close < currEMA && curr.close < curr.open) {
    signalType = 'SELL';
    confidence += 35;
    if (currRSI > 35 && currRSI < 60) confidence += 20;
    if (emaSlope === 'down') confidence += 15;
    const pinBarRatio = (curr.open - curr.close) / (curr.high - curr.low || 1);
    if (pinBarRatio > 0.5) confidence += 15;
    confidence += 15;
  }

  if (!signalType || confidence < (params.minConfidence || 50)) return null;

  const stopLoss = signalType === 'BUY'
    ? curr.low - currATR * atrMult
    : curr.high + currATR * atrMult;
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

  const last3AboveEMA = candles.slice(-4, -1).every((c, i) => {
    const idx = n - 4 + i;
    return c.close > (ema25[idx] || 0);
  });
  const last3BelowEMA = candles.slice(-4, -1).every((c, i) => {
    const idx = n - 4 + i;
    return c.close < (ema25[idx] || 0);
  });

  let signalType: SignalType | null = null;
  let confidence = 0;

  if (last3AboveEMA && curr.close > currEMA && prevRSI < rsiOversold + 10 && currRSI > prevRSI) {
    signalType = 'BUY';
    confidence += 30;
    if (curr.close > currEMA) confidence += 20;
    if (last3AboveEMA) confidence += 20;
    if (currRSI > prevRSI) confidence += 15;
    if (currRSI < 55) confidence += 15;
  } else if (last3BelowEMA && curr.close < currEMA && prevRSI > rsiOverbought - 10 && currRSI < prevRSI) {
    signalType = 'SELL';
    confidence += 30;
    if (curr.close < currEMA) confidence += 20;
    if (last3BelowEMA) confidence += 20;
    if (currRSI < prevRSI) confidence += 15;
    if (currRSI > 45) confidence += 15;
  }

  if (!signalType || confidence < (params.minConfidence || 50)) return null;

  const stopLoss = signalType === 'BUY'
    ? currEMA - currATR * atrMult
    : currEMA + currATR * atrMult;
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
  const atrMult = params.atrMultiplierSL || 0.3;
  const touchThreshold = params.touchThreshold || 0.0005; // 0.05% — tighter than 5m

  // Short lookback for 1m EMA slope
  const emaSlope = isEMASloping(ema25, 3);

  // Touch detection: current OR previous candle's wick crossed EMA
  const wickedThruEMA = (c: Candle, ema: number) => c.low <= ema && c.high >= ema;
  const nearEMA = (price: number, ema: number) => Math.abs(price - ema) / ema < touchThreshold;

  const currBullTouch = nearEMA(curr.low, currEMA) || wickedThruEMA(curr, currEMA);
  const prevBullTouch = nearEMA(prev.low, prevEMA) || wickedThruEMA(prev, prevEMA);
  const currBearTouch = nearEMA(curr.high, currEMA) || wickedThruEMA(curr, currEMA);
  const prevBearTouch = nearEMA(prev.high, prevEMA) || wickedThruEMA(prev, prevEMA);

  const bullishTouch = currBullTouch || prevBullTouch;
  const bearishTouch = currBearTouch || prevBearTouch;

  // SL anchored to the actual touching candle's extreme
  const slRefLow = prevBullTouch ? Math.min(prev.low, curr.low) : curr.low;
  const slRefHigh = prevBearTouch ? Math.max(prev.high, curr.high) : curr.high;

  let signalType: SignalType | null = null;
  let confidence = 0;

  if ((emaSlope === 'up' || emaSlope === 'flat') && bullishTouch
    && curr.close > currEMA && curr.close > curr.open) {
    signalType = 'BUY';
    confidence += 30;
    if (emaSlope === 'up') confidence += 15;
    if (currRSI > 40 && currRSI < 65) confidence += 15;
    if (curr.volume > volumeSma20) confidence += 15;
    const lowerWick = Math.min(curr.open, curr.close) - curr.low;
    const body = curr.close - curr.open;
    if (body > 0 && lowerWick > body * 1.5) confidence += 15; // hammer
    const prev2AboveEMA = candles.slice(-3, -1).every((c, i) => c.close > (ema25[n - 3 + i] || 0));
    if (prev2AboveEMA) confidence += 10;
  } else if ((emaSlope === 'down' || emaSlope === 'flat') && bearishTouch
    && curr.close < currEMA && curr.close < curr.open) {
    signalType = 'SELL';
    confidence += 30;
    if (emaSlope === 'down') confidence += 15;
    if (currRSI > 35 && currRSI < 60) confidence += 15;
    if (curr.volume > volumeSma20) confidence += 15;
    const upperWick = curr.high - Math.max(curr.open, curr.close);
    const body = curr.open - curr.close;
    if (body > 0 && upperWick > body * 1.5) confidence += 15; // shooting star
    const prev2BelowEMA = candles.slice(-3, -1).every((c, i) => c.close < (ema25[n - 3 + i] || 0));
    if (prev2BelowEMA) confidence += 10;
  }

  if (!signalType || confidence < (params.minConfidence || 50)) return null;

  const stopLoss = signalType === 'BUY'
    ? slRefLow - currATR * atrMult
    : slRefHigh + currATR * atrMult;
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
