import { Router, Request, Response } from 'express';
import pool from '../config/db';
import { getCandles } from '../services/candleStore';
import { Timeframe } from '../types';
import { calculateEMA } from '../indicators/ema';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const timeframe = (req.query.timeframe as Timeframe) || '15m';
    const limit = Math.min(parseInt(req.query.limit as string) || 1000, 1000);

    const candles = getCandles(timeframe, limit);

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
