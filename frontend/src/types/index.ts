export type Timeframe = '1m' | '3m' | '5m' | '15m' | '30m' | '1h' | '4h' | '1d';
export type SignalType = 'BUY' | 'SELL' | 'HOLD';
export type SignalStrength = 'LOW' | 'MEDIUM' | 'HIGH';
export type StrategyType = 'EMA25_CROSSOVER' | 'EMA25_BOUNCE' | 'EMA25_RSI';

export interface Candle {
  openTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  closeTime: number;
  isClosed: boolean;
}

export interface EMAPoint {
  time: number;
  value: number;
}

export interface Signal {
  id?: number;
  strategyId: number;
  strategyName: string;
  strategyType: StrategyType;
  timeframe: Timeframe;
  signalType: SignalType;
  price: number;
  ema25: number;
  rsi?: number;
  confidence: number;
  strength: SignalStrength;
  stopLoss: number;
  takeProfit: number;
  riskReward: number;
  atr: number;
  createdAt?: string;
}

export interface Strategy {
  id?: number;
  name: string;
  type: StrategyType;
  timeframe: Timeframe;
  riskPercent: number;
  enabled: boolean;
  params: Record<string, any>;
  createdAt?: string;
}

export interface Ticker {
  symbol: string;
  price: number;
  priceChange: number;
  priceChangePercent: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  quoteVolume24h: number;
}

export interface OrderBookEntry {
  price: number;
  quantity: number;
}

export interface OrderBook {
  bids: OrderBookEntry[];
  asks: OrderBookEntry[];
}

export type TradeStatus = 'OPEN' | 'CLOSED';
export type TradeResult = 'WIN' | 'LOSS';

export interface Trade {
  id?: number;
  signalId?: number | null;
  strategyId: number;
  strategyName: string;
  timeframe: Timeframe;
  signalType: SignalType;
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  exitPrice?: number | null;
  status: TradeStatus;
  result?: TradeResult | null;
  pnlPercent?: number | null;
  riskAmount?: number | null;
  pnlUsd?: number | null;
  confidence: number;
  riskReward: number;
  openedAt?: string;
  closedAt?: string | null;
}
