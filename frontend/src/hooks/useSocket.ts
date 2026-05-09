import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useChartStore, useSignalStore, useTickerStore, useOrderBookStore } from '../store';
import { Timeframe } from '../types';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io('/', { transports: ['websocket', 'polling'] });
  }
  return socket;
}

export function useSocket() {
  const { timeframe, updateCandle, setCandles } = useChartStore();
  const { addSignal } = useSignalStore();
  const { setTicker } = useTickerStore();
  const { setOrderBook } = useOrderBookStore();
  const prevTimeframe = useRef<Timeframe | null>(null);

  useEffect(() => {
    const s = getSocket();

    s.on('ticker:update', setTicker);
    s.on('signal:new', addSignal);
    s.on('orderbook:update', setOrderBook);

    s.on('candle:update', ({ timeframe: tf, candle, ema25 }) => {
      if (tf === useChartStore.getState().timeframe) {
        updateCandle(candle, ema25);
      }
    });

    s.on('candles:history', ({ timeframe: tf, candles, ema25 }) => {
      if (tf === useChartStore.getState().timeframe) {
        setCandles(candles, ema25);
      }
    });

    return () => {
      s.off('ticker:update', setTicker);
      s.off('signal:new', addSignal);
      s.off('orderbook:update', setOrderBook);
      s.off('candle:update');
      s.off('candles:history');
    };
  }, []);

  useEffect(() => {
    const s = getSocket();
    if (prevTimeframe.current !== timeframe) {
      s.emit('subscribe:timeframe', timeframe);
      prevTimeframe.current = timeframe;
    }
  }, [timeframe]);
}
