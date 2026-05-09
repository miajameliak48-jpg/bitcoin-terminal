import { useEffect, useRef, useCallback } from 'react';
import {
  createChart,
  IChartApi,
  ISeriesApi,
  CandlestickData,
  LineData,
  Time,
  ColorType,
  CrosshairMode,
} from 'lightweight-charts';
import { useChartStore, useSignalStore } from '../store';

export default function TradingChart() {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const emaSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);

  const { candles, ema25, isLoading } = useChartStore();
  const { signals } = useSignalStore();

  const initChart = useCallback(() => {
    if (!containerRef.current) return;

    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#0d1117' },
        textColor: '#8b949e',
      },
      grid: {
        vertLines: { color: '#1c2128' },
        horzLines: { color: '#1c2128' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: '#30363d', labelBackgroundColor: '#1f6feb' },
        horzLine: { color: '#30363d', labelBackgroundColor: '#1f6feb' },
      },
      rightPriceScale: { borderColor: '#30363d' },
      timeScale: {
        borderColor: '#30363d',
        timeVisible: true,
        secondsVisible: false,
      },
      handleScroll: true,
      handleScale: true,
    });

    const candleSeries = chart.addCandlestickSeries({
      upColor: '#3fb950',
      downColor: '#f85149',
      borderUpColor: '#3fb950',
      borderDownColor: '#f85149',
      wickUpColor: '#3fb950',
      wickDownColor: '#f85149',
    });

    const emaSeries = chart.addLineSeries({
      color: '#ff9500',
      lineWidth: 2,
      title: 'EMA25',
      priceLineVisible: false,
      lastValueVisible: true,
    });

    const volumeSeries = chart.addHistogramSeries({
      color: '#1f6feb44',
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
    });

    chart.priceScale('volume').applyOptions({
      scaleMargins: { top: 0.85, bottom: 0 },
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    emaSeriesRef.current = emaSeries;
    volumeSeriesRef.current = volumeSeries;

    const ro = new ResizeObserver(() => {
      if (containerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    });
    ro.observe(containerRef.current);

    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const cleanup = initChart();
    return cleanup;
  }, [initChart]);

  useEffect(() => {
    if (!candleSeriesRef.current || !emaSeriesRef.current || !volumeSeriesRef.current) return;
    if (candles.length === 0) return;

    const cdData: CandlestickData[] = candles.map(c => ({
      time: Math.floor(c.openTime / 1000) as Time,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));

    const volData = candles.map(c => ({
      time: Math.floor(c.openTime / 1000) as Time,
      value: c.volume,
      color: c.close >= c.open ? '#3fb95033' : '#f8514933',
    }));

    const emaData: LineData[] = ema25.map(p => ({
      time: p.time as Time,
      value: p.value,
    }));

    candleSeriesRef.current.setData(cdData);
    volumeSeriesRef.current.setData(volData);

    if (emaData.length > 0) {
      emaSeriesRef.current.setData(emaData);
    }

    chartRef.current?.timeScale().fitContent();
  }, [candles.length > 0 ? candles[0].openTime : null]);

  // Realtime updates
  useEffect(() => {
    if (!candleSeriesRef.current || candles.length === 0) return;
    const last = candles[candles.length - 1];
    candleSeriesRef.current.update({
      time: Math.floor(last.openTime / 1000) as Time,
      open: last.open,
      high: last.high,
      low: last.low,
      close: last.close,
    });
    volumeSeriesRef.current?.update({
      time: Math.floor(last.openTime / 1000) as Time,
      value: last.volume,
      color: last.close >= last.open ? '#3fb95033' : '#f8514933',
    });
    if (ema25.length > 0) {
      const lastEMA = ema25[ema25.length - 1];
      if (lastEMA) {
        emaSeriesRef.current?.update({ time: lastEMA.time as Time, value: lastEMA.value });
      }
    }
  }, [candles]);

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full" />
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#0d1117] z-10">
          <div className="flex flex-col items-center gap-2">
            <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            <span className="text-xs text-muted">Загрузка свечей...</span>
          </div>
        </div>
      )}
    </div>
  );
}
