import pool from '../config/db';

export async function getBalance(): Promise<number> {
  const { rows } = await pool.query('SELECT balance FROM account_settings WHERE id = 1');
  return rows.length > 0 ? parseFloat(rows[0].balance) : 10000;
}

export async function setBalance(balance: number): Promise<number> {
  const safe = Math.max(0, balance);
  await pool.query(
    'UPDATE account_settings SET balance = $1, updated_at = NOW() WHERE id = 1',
    [safe]
  );
  return safe;
}

// Atomically adds pnlUsd to balance (floors at 0), returns new balance.
export async function applyPnl(pnlUsd: number): Promise<number> {
  const { rows } = await pool.query(
    'UPDATE account_settings SET balance = GREATEST(0, balance + $1), updated_at = NOW() WHERE id = 1 RETURNING balance',
    [pnlUsd]
  );
  return parseFloat(rows[0].balance);
}
