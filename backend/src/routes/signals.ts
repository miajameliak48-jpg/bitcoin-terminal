import { Router, Request, Response } from 'express';
import pool from '../config/db';
import { calculateRiskParams } from '../services/strategyRunner';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const timeframe = req.query.timeframe as string;

    let query = `SELECT id, strategy_id, strategy_name, strategy_type, timeframe, signal_type,
      price, ema25, rsi, confidence, strength, stop_loss, take_profit, risk_reward, atr, created_at
      FROM signals`;
    const params: any[] = [];

    if (timeframe) {
      query += ' WHERE timeframe = $1';
      params.push(timeframe);
    }

    query += ` ORDER BY created_at DESC LIMIT ${limit}`;

    const { rows } = await pool.query(query, params);
    res.json(rows.map(r => ({
      id: r.id,
      strategyId: r.strategy_id,
      strategyName: r.strategy_name,
      strategyType: r.strategy_type,
      timeframe: r.timeframe,
      signalType: r.signal_type,
      price: parseFloat(r.price),
      ema25: parseFloat(r.ema25),
      rsi: r.rsi ? parseFloat(r.rsi) : null,
      confidence: parseFloat(r.confidence),
      strength: r.strength,
      stopLoss: parseFloat(r.stop_loss),
      takeProfit: parseFloat(r.take_profit),
      riskReward: parseFloat(r.risk_reward),
      atr: parseFloat(r.atr),
      createdAt: r.created_at,
    })));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/risk', (req: Request, res: Response) => {
  try {
    const { accountBalance, riskPercent, entryPrice, stopLossPrice, rrRatio } = req.body;
    if (!accountBalance || !riskPercent || !entryPrice || !stopLossPrice) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    const result = calculateRiskParams(
      parseFloat(accountBalance),
      parseFloat(riskPercent),
      parseFloat(entryPrice),
      parseFloat(stopLossPrice),
      parseFloat(rrRatio) || 2
    );
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
