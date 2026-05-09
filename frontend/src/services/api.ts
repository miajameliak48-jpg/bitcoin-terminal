import axios from 'axios';
import { Candle, EMAPoint, Signal, Strategy, Ticker, Trade } from '../types';

const api = axios.create({ baseURL: '/api' });

export async function fetchCandles(timeframe: string, limit = 200): Promise<{ candles: Candle[]; ema25: EMAPoint[] }> {
  const { data } = await api.get('/candles', { params: { timeframe, limit } });
  return data;
}

export async function fetchSignals(limit = 50): Promise<Signal[]> {
  const { data } = await api.get('/signals', { params: { limit } });
  return data;
}

export async function fetchStrategies(): Promise<Strategy[]> {
  const { data } = await api.get('/strategies');
  return data;
}

export async function fetchTicker(): Promise<Ticker> {
  const { data } = await api.get('/ticker');
  return data;
}

export async function updateStrategy(id: number, patch: Partial<Strategy>): Promise<Strategy> {
  const { data } = await api.put(`/strategies/${id}`, patch);
  return data;
}

export async function createStrategy(strategy: Omit<Strategy, 'id' | 'createdAt'>): Promise<Strategy> {
  const { data } = await api.post('/strategies', strategy);
  return data;
}

export async function calculateRisk(params: {
  accountBalance: number;
  riskPercent: number;
  entryPrice: number;
  stopLossPrice: number;
  rrRatio: number;
}) {
  const { data } = await api.post('/signals/risk', params);
  return data;
}

export async function fetchTrades(status: 'open' | 'closed', limit = 100): Promise<Trade[]> {
  const { data } = await api.get('/trades', { params: { status, limit } });
  return data;
}

export async function closeTrade(id: number, exitPrice: number): Promise<Trade> {
  const { data } = await api.put(`/trades/${id}/close`, { exitPrice });
  return data;
}

export async function openTrade(params: {
  signalType: 'BUY' | 'SELL';
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
}): Promise<Trade> {
  const { data } = await api.post('/trades', params);
  return data;
}
