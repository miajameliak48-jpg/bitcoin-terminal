import { Router, Request, Response } from 'express';
import { getCandles } from '../services/candleStore';
import { fetchHistoricalCandles } from '../services/binanceWs';
import { Timeframe } from '../types';
import { calculateEMA } from '../indicators/ema';

const VALID_TIMEFRAMES = new Set(['1s','1m','3m','5m','15m','30m','1h','2h','4h','6h','8h','12h','1d','3d','1w','1M']);

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const timeframe = (req.query.timeframe as string) || '15m';
    const limit = Math.min(parseInt(req.query.limit as string) || 1000, 1000);

    if (!VALID_TIMEFRAMES.has(timeframe)) {
      return res.status(400).json({ error: 'Invalid timeframe' });
    }

    let candles = getCandles(timeframe as Timeframe, limit);

    // Fallback: fetch from Binance REST if not in memory (custom / less-common TFs)
    if (candles.length === 0) {
      candles = await fetchHistoricalCandles(timeframe as Timeframe, limit);
    }

    if (candles.length === 0) {
      return res.json({ candles: [], ema25: [] });
    }

    const closes = candles.map(c => c.close);
    const ema25 = calculateEMA(closes, 25);

    res.json({
      candles,
      ema25: ema25.map((v, i) => ({
        time: Math.floor(candles[i].openTime / 1000),
        value: v > 0 ? v : null,
      })).filter(p => p.value !== null),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
