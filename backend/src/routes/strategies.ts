import { Router, Request, Response } from 'express';
import pool from '../config/db';

const router = Router();

function mapStrategy(r: any) {
  return {
    id: r.id,
    name: r.name,
    type: r.type,
    timeframe: r.timeframe,
    riskPercent: parseFloat(r.risk_percent),
    leverage: r.leverage || 1,
    enabled: r.enabled,
    params: r.params,
    riskManagementId: r.risk_management_id || null,
    riskManagement: r.risk_management_id ? {
      id: r.risk_management_id,
      name: r.rm_name,
      riskPercent: parseFloat(r.rm_risk_percent),
      stopLossPercent: parseFloat(r.rm_stop_loss_percent),
      takeProfitPercent: parseFloat(r.rm_take_profit_percent),
    } : null,
    createdAt: r.created_at,
  };
}

router.get('/', async (_req: Request, res: Response) => {
  try {
    const { rows } = await pool.query(`
      SELECT s.id, s.name, s.type, s.timeframe, s.risk_percent, s.leverage, s.enabled, s.params,
             s.risk_management_id, s.created_at,
             rm.name AS rm_name, rm.risk_percent AS rm_risk_percent,
             rm.stop_loss_percent AS rm_stop_loss_percent, rm.take_profit_percent AS rm_take_profit_percent
      FROM strategies s
      LEFT JOIN risk_management rm ON s.risk_management_id = rm.id
      ORDER BY s.id
    `);
    res.json(rows.map(mapStrategy));
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
    res.status(201).json(mapStrategy(rows[0]));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, enabled, riskPercent, leverage, params } = req.body;

    const fields: string[] = [];
    const values: any[] = [];
    let n = 1;

    if (name !== undefined)       { fields.push(`name = $${n++}`);         values.push(name); }
    if (enabled !== undefined)    { fields.push(`enabled = $${n++}`);      values.push(enabled); }
    if (riskPercent !== undefined){ fields.push(`risk_percent = $${n++}`); values.push(riskPercent); }
    if (leverage !== undefined)   { fields.push(`leverage = $${n++}`);     values.push(leverage); }
    if (params !== undefined)     { fields.push(`params = $${n++}::jsonb`);values.push(JSON.stringify(params)); }
    // riskManagementId can be explicitly set to null to clear it
    if ('riskManagementId' in req.body) {
      fields.push(`risk_management_id = $${n++}`);
      values.push(req.body.riskManagementId ?? null);
    }

    if (fields.length === 0) return res.status(400).json({ error: 'No fields to update' });

    values.push(id);
    const { rows } = await pool.query(
      `UPDATE strategies SET ${fields.join(', ')} WHERE id = $${n} RETURNING *`,
      values
    );
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });

    // Re-fetch with JOIN to return riskManagement
    const { rows: full } = await pool.query(`
      SELECT s.*, rm.name AS rm_name, rm.risk_percent AS rm_risk_percent,
             rm.stop_loss_percent AS rm_stop_loss_percent, rm.take_profit_percent AS rm_take_profit_percent
      FROM strategies s
      LEFT JOIN risk_management rm ON s.risk_management_id = rm.id
      WHERE s.id = $1
    `, [rows[0].id]);
    res.json(mapStrategy(full[0]));
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
