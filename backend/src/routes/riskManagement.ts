import { Router, Request, Response } from 'express';
import pool from '../config/db';

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, name, risk_percent, stop_loss_percent, take_profit_percent, created_at FROM risk_management ORDER BY id'
    );
    res.json(rows.map(r => ({
      id: r.id,
      name: r.name,
      riskPercent: parseFloat(r.risk_percent),
      stopLossPercent: parseFloat(r.stop_loss_percent),
      takeProfitPercent: parseFloat(r.take_profit_percent),
      createdAt: r.created_at,
    })));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, riskPercent, stopLossPercent, takeProfitPercent } = req.body;
    if (!name || riskPercent == null || stopLossPercent == null || takeProfitPercent == null) {
      return res.status(400).json({ error: 'name, riskPercent, stopLossPercent, takeProfitPercent required' });
    }
    const { rows } = await pool.query(
      'INSERT INTO risk_management (name, risk_percent, stop_loss_percent, take_profit_percent) VALUES ($1,$2,$3,$4) RETURNING *',
      [name, riskPercent, stopLossPercent, takeProfitPercent]
    );
    res.status(201).json({
      id: rows[0].id,
      name: rows[0].name,
      riskPercent: parseFloat(rows[0].risk_percent),
      stopLossPercent: parseFloat(rows[0].stop_loss_percent),
      takeProfitPercent: parseFloat(rows[0].take_profit_percent),
      createdAt: rows[0].created_at,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { name, riskPercent, stopLossPercent, takeProfitPercent } = req.body;
    const { rows } = await pool.query(
      `UPDATE risk_management SET
        name = COALESCE($1, name),
        risk_percent = COALESCE($2, risk_percent),
        stop_loss_percent = COALESCE($3, stop_loss_percent),
        take_profit_percent = COALESCE($4, take_profit_percent)
       WHERE id = $5 RETURNING *`,
      [name ?? null, riskPercent ?? null, stopLossPercent ?? null, takeProfitPercent ?? null, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json({
      id: rows[0].id,
      name: rows[0].name,
      riskPercent: parseFloat(rows[0].risk_percent),
      stopLossPercent: parseFloat(rows[0].stop_loss_percent),
      takeProfitPercent: parseFloat(rows[0].take_profit_percent),
      createdAt: rows[0].created_at,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    await pool.query('DELETE FROM risk_management WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
