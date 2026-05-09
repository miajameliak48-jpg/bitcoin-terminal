import { useEffect, useRef, useCallback } from 'react';
import {
  createChart,
  IChartApi,
  ISeriesApi,
  Time,
  ColorType,
  CrosshairMode,
  BaselineData,
} from 'lightweight-charts';
import { useChartStore } from '../store';

export default function EMAOscillator() {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const baselineSeriesRef = useRef<ISeriesApi<'Baseline'> | null>(null);

  const { candles, ema25 } = useChartStore();

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

    const baselineSeries = chart.addBaselineSeries({
      baseValue: { type: 'price', price: 0 },
      topLineColor: '#3fb950',
      topFillColor1: '#3fb95055',
      topFillColor2: '#3fb95018',
      bottomLineColor: '#f85149',
      bottomFillColor1: '#f8514918',
      bottomFillColor2: '#f8514955',
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: true,
    });

    chartRef.current = chart;
    baselineSeriesRef.current = baselineSeries;

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

  // Initial / timeframe data load
  useEffect(() => {
    if (!baselineSeriesRef.current || candles.length === 0 || ema25.length === 0) return;

    const emaMap = new Map<number, number>();
    ema25.forEach(p => emaMap.set(p.time as number, p.value));

    const data: BaselineData[] = candles
      .map(c => {
        const t = Math.floor(c.openTime / 1000);
        const emaValue = emaMap.get(t);
        if (emaValue === undefined) return null;
        return { time: t as Time, value: c.close - emaValue };
      })
      .filter((d): d is BaselineData => d !== null);

    if (data.length > 0) {
      baselineSeriesRef.current.setData(data);
      chartRef.current?.timeScale().fitContent();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candles.length > 0 ? candles[0].openTime : null, ema25.length]);

  // Realtime updates
  useEffect(() => {
    if (!baselineSeriesRef.current || candles.length === 0 || ema25.length === 0) return;
    const last = candles[candles.length - 1];
    const lastEMA = ema25[ema25.length - 1];
    if (!lastEMA) return;
    baselineSeriesRef.current.update({
      time: Math.floor(last.openTime / 1000) as Time,
      value: last.close - lastEMA.value,
    });
  }, [candles]);

  return <div ref={containerRef} className="w-full h-full" />;
}
