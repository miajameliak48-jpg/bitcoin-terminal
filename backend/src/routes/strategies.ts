import { Router, Request, Response } from 'express';
import pool from '../config/db';

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, name, type, timeframe, risk_percent, leverage, enabled, params, created_at FROM strategies ORDER BY id'
    );
    res.json(rows.map(r => ({
      id: r.id,
      name: r.name,
      type: r.type,
      timeframe: r.timeframe,
      riskPercent: parseFloat(r.risk_percent),
      leverage: r.leverage || 1,
      enabled: r.enabled,
      params: r.params,
      createdAt: r.created_at,
    })));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, type, timeframe, riskPercent = 1.0, leverage = 1, params = {} } = req.body;
    if (!name || !type || !timeframe) {
      return res.status(400).json({ error: 'name, type, timeframe required' });
    }
    const { rows } = await pool.query(
      'INSERT INTO strategies (name, type, timeframe, risk_percent, leverage, params) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
      [name, type, timeframe, riskPercent, leverage, JSON.stringify(params)]
    );
    res.status(201).json(rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, enabled, riskPercent, leverage, params } = req.body;
    const { rows } = await pool.query(
      `UPDATE strategies SET
        name = COALESCE($1, name),
        enabled = COALESCE($2, enabled),
        risk_percent = COALESCE($3, risk_percent),
        leverage = COALESCE($4, leverage),
        params = COALESCE($5::jsonb, params)
      WHERE id = $6 RETURNING *`,
      [name, enabled, riskPercent, leverage ?? null, params ? JSON.stringify(params) : null, id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    await pool.query('UPDATE strategies SET enabled = false WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
