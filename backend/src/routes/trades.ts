import { Router } from 'express';
import { Server as SocketIOServer } from 'socket.io';
import pool from '../config/db';
import { getBalance, setBalance, applyPnl } from '../services/balanceService';
import { Trade } from '../types';

export function rowToTrade(r: any): Trade {
  return {
    id: r.id,
    signalId: r.signal_id,
    strategyId: r.strategy_id,
    strategyName: r.strategy_name,
    timeframe: r.timeframe,
    signalType: r.signal_type,
    entryPrice: parseFloat(r.entry_price),
    stopLoss: parseFloat(r.stop_loss),
    takeProfit: parseFloat(r.take_profit),
    exitPrice: r.exit_price ? parseFloat(r.exit_price) : null,
    status: r.status,
    result: r.result || null,
    pnlPercent: r.pnl_percent ? parseFloat(r.pnl_percent) : null,
    riskAmount: r.risk_amount ? parseFloat(r.risk_amount) : null,
    pnlUsd: r.pnl_usd ? parseFloat(r.pnl_usd) : null,
    confidence: parseFloat(r.confidence),
    riskReward: parseFloat(r.risk_reward),
    openedAt: r.opened_at,
    closedAt: r.closed_at || null,
  };
}

export function createTradesRouter(io: SocketIOServer) {
  const router = Router();

  // GET /api/trades?status=open|closed&limit=100
  router.get('/', async (req, res) => {
    const status = ((req.query.status as string) || 'open').toUpperCase();
    const limit = Math.min(parseInt((req.query.limit as string) || '100'), 500);
    try {
      const orderCol = status === 'OPEN' ? 'opened_at' : 'closed_at';
      const { rows } = await pool.query(
        `SELECT * FROM trades WHERE status = $1 ORDER BY ${orderCol} DESC LIMIT $2`,
        [status, limit]
      );
      res.json(rows.map(rowToTrade));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/trades — manual trade (1% risk by default)
  router.post('/', async (req, res) => {
    const { signalType, entryPrice, stopLoss, takeProfit } = req.body as {
      signalType: string; entryPrice: number; stopLoss: number; takeProfit: number;
    };
    if (!['BUY', 'SELL'].includes(signalType) || !entryPrice || !stopLoss || !takeProfit) {
      return res.status(400).json({ error: 'signalType, entryPrice, stopLoss, takeProfit required' });
    }
    const entry = Number(entryPrice);
    const sl = Number(stopLoss);
    const tp = Number(takeProfit);
    const rr = parseFloat((Math.abs(tp - entry) / Math.abs(entry - sl)).toFixed(2));
    try {
      const balance = await getBalance();
      const riskAmount = parseFloat((balance * 0.01).toFixed(8));
      const { rows } = await pool.query(
        `INSERT INTO trades (strategy_name, timeframe, signal_type, entry_price, stop_loss, take_profit, confidence, risk_reward, risk_amount)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
        ['Ручная', 'manual', signalType, entry, sl, tp, 75, rr, riskAmount]
      );
      res.status(201).json(rowToTrade(rows[0]));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // PUT /api/trades/:id/close
  router.put('/:id/close', async (req, res) => {
    const { exitPrice } = req.body as { exitPrice: number };
    if (!exitPrice || isNaN(Number(exitPrice))) {
      return res.status(400).json({ error: 'exitPrice required' });
    }
    try {
      const { rows } = await pool.query(
        `SELECT * FROM trades WHERE id = $1 AND status = 'OPEN'`,
        [req.params.id]
      );
      if (!rows.length) {
        return res.status(404).json({ error: 'Open trade not found' });
      }
      const trade = rows[0];
      const entryPrice = parseFloat(trade.entry_price);
      const price = Number(exitPrice);
      const isBuy = trade.signal_type === 'BUY';
      const pnlPercent = isBuy
        ? ((price - entryPrice) / entryPrice) * 100
        : ((entryPrice - price) / entryPrice) * 100;
      const result = pnlPercent >= 0 ? 'WIN' : 'LOSS';

      const riskAmount = trade.risk_amount ? parseFloat(trade.risk_amount) : 0;
      const stopDist = Math.abs(entryPrice - parseFloat(trade.stop_loss));
      const positionSizeBtc = stopDist > 0 ? riskAmount / stopDist : 0;
      const pnlUsd = positionSizeBtc * (price - entryPrice) * (isBuy ? 1 : -1);

      const { rows: [updated] } = await pool.query(
        `UPDATE trades
         SET exit_price = $1, status = 'CLOSED', result = $2, pnl_percent = $3, pnl_usd = $4, closed_at = NOW()
         WHERE id = $5 RETURNING *`,
        [price, result, pnlPercent.toFixed(4), pnlUsd.toFixed(8), req.params.id]
      );

      if (riskAmount > 0) {
        const newBalance = await applyPnl(pnlUsd);
        io.emit('balance:update', newBalance);
      }

      res.json(rowToTrade(updated));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // DELETE /api/trades — clear all trade history and reset balance to 10000
  router.delete('/', async (_req, res) => {
    try {
      await pool.query(`DELETE FROM trades`);
      await pool.query(`DELETE FROM signals`);
      const newBalance = await setBalance(10000);
      io.emit('trades:open', []);
      io.emit('trades:closed', []);
      io.emit('balance:update', newBalance);
      res.json({ ok: true, balance: newBalance });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}

// Keep a default export for backwards compat (unused but avoids import errors)
export default createTradesRouter;
