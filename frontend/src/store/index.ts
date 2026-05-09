import { create } from 'zustand';
import { Candle, EMAPoint, Signal, Strategy, RiskManagement, Ticker, OrderBook, Timeframe, Trade } from '../types';

interface ChartState {
  timeframe: Timeframe;
  candles: Candle[];
  ema25: EMAPoint[];
  isLoading: boolean;
  setTimeframe: (tf: Timeframe) => void;
  setCandles: (candles: Candle[], ema25: EMAPoint[]) => void;
  updateCandle: (candle: Candle, ema25Value: number | null) => void;
}

export const useChartStore = create<ChartState>((set) => ({
  timeframe: '15m',
  candles: [],
  ema25: [],
  isLoading: true,
  setTimeframe: (timeframe) => set({ timeframe, candles: [], ema25: [], isLoading: true }),
  setCandles: (candles, ema25) => set({ candles, ema25, isLoading: false }),
  updateCandle: (candle, ema25Value) =>
    set((state) => {
      const candles = [...state.candles];
      const last = candles[candles.length - 1];
      if (last && last.openTime === candle.openTime) {
        candles[candles.length - 1] = candle;
      } else {
        candles.push(candle);
        if (candles.length > 500) candles.shift();
      }

      let ema25 = [...state.ema25];
      if (ema25Value !== null && ema25Value > 0) {
        const t = Math.floor(candle.openTime / 1000);
        const lastEMA = ema25[ema25.length - 1];
        if (lastEMA && lastEMA.time === t) {
          ema25[ema25.length - 1] = { time: t, value: ema25Value };
        } else {
          ema25.push({ time: t, value: ema25Value });
          if (ema25.length > 500) ema25.shift();
        }
      }
      return { candles, ema25 };
    }),
}));

interface SignalState {
  signals: Signal[];
  addSignal: (signal: Signal) => void;
  setSignals: (signals: Signal[]) => void;
}

export const useSignalStore = create<SignalState>((set) => ({
  signals: [],
  addSignal: (signal) =>
    set((state) => ({ signals: [signal, ...state.signals].slice(0, 100) })),
  setSignals: (signals) => set({ signals }),
}));

interface TickerState {
  ticker: Ticker | null;
  setTicker: (ticker: Ticker) => void;
}

export const useTickerStore = create<TickerState>((set) => ({
  ticker: null,
  setTicker: (ticker) => set({ ticker }),
}));

interface OrderBookState {
  orderBook: OrderBook | null;
  setOrderBook: (ob: OrderBook) => void;
}

export const useOrderBookStore = create<OrderBookState>((set) => ({
  orderBook: null,
  setOrderBook: (orderBook) => set({ orderBook }),
}));

interface StrategyState {
  strategies: Strategy[];
  setStrategies: (strategies: Strategy[]) => void;
  updateStrategy: (id: number, patch: Partial<Strategy>) => void;
}

export const useStrategyStore = create<StrategyState>((set) => ({
  strategies: [],
  setStrategies: (strategies) => set({ strategies }),
  updateStrategy: (id, patch) =>
    set((state) => ({
      strategies: state.strategies.map(s => s.id === id ? { ...s, ...patch } : s),
    })),
}));

interface BalanceState {
  balance: number;
  // syncToServer=true persists to localStorage and triggers server sync (via Header/api)
  // syncToServer=false is used when receiving balance:update from socket (server is already updated)
  setBalance: (b: number, syncToServer?: boolean) => void;
}

export const useBalanceStore = create<BalanceState>((set) => ({
  balance: (() => {
    const saved = localStorage.getItem('btc_balance');
    return saved ? parseFloat(saved) || 10000 : 10000;
  })(),
  setBalance: (balance, syncToServer = true) => {
    localStorage.setItem('btc_balance', balance.toString());
    set({ balance });
    // Actual server sync is done by the caller (Header) when syncToServer=true
    void syncToServer;
  },
}));

interface TradeState {
  openTrades: Trade[];
  closedTrades: Trade[];
  setOpenTrades: (trades: Trade[]) => void;
  setClosedTrades: (trades: Trade[]) => void;
  addTrade: (trade: Trade) => void;
  moveToClosed: (trade: Trade) => void;
}

export const useTradeStore = create<TradeState>((set) => ({
  openTrades: [],
  closedTrades: [],
  setOpenTrades: (openTrades) => set({ openTrades }),
  setClosedTrades: (closedTrades) => set({ closedTrades }),
  addTrade: (trade) =>
    set((state) => ({ openTrades: [trade, ...state.openTrades] })),
  moveToClosed: (trade) =>
    set((state) => ({
      openTrades: state.openTrades.filter(t => t.id !== trade.id),
      closedTrades: [trade, ...state.closedTrades].slice(0, 200),
    })),
}));

interface RiskManagementState {
  profiles: RiskManagement[];
  setProfiles: (profiles: RiskManagement[]) => void;
  addProfile: (profile: RiskManagement) => void;
  removeProfile: (id: number) => void;
}

export const useRiskManagementStore = create<RiskManagementState>((set) => ({
  profiles: [],
  setProfiles: (profiles) => set({ profiles }),
  addProfile: (profile) => set((state) => ({ profiles: [...state.profiles, profile] })),
  removeProfile: (id) => set((state) => ({ profiles: state.profiles.filter(p => p.id !== id) })),
}));
