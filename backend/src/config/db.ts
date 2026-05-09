import { Pool } from 'pg';

const pool = new Pool({
  host: '127.0.0.1',
  port: 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'ITY3OvroBGJOc6I46AylUpct',
  database: process.env.DB_NAME || 'bitcoin_terminal',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

export async function initDB(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS strategies (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        type VARCHAR(50) NOT NULL,
        timeframe VARCHAR(10) NOT NULL,
        risk_percent DECIMAL(5,2) DEFAULT 1.0,
        enabled BOOLEAN DEFAULT TRUE,
        params JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS candles (
        id BIGSERIAL PRIMARY KEY,
        timeframe VARCHAR(10) NOT NULL,
        open_time BIGINT NOT NULL,
        open DECIMAL(20,8) NOT NULL,
        high DECIMAL(20,8) NOT NULL,
        low DECIMAL(20,8) NOT NULL,
        close DECIMAL(20,8) NOT NULL,
        volume DECIMAL(30,8) NOT NULL,
        close_time BIGINT NOT NULL,
        is_closed BOOLEAN DEFAULT FALSE,
        UNIQUE(timeframe, open_time)
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS signals (
        id BIGSERIAL PRIMARY KEY,
        strategy_id INTEGER REFERENCES strategies(id),
        strategy_name VARCHAR(100),
        strategy_type VARCHAR(50),
        timeframe VARCHAR(10) NOT NULL,
        signal_type VARCHAR(10) NOT NULL,
        price DECIMAL(20,8) NOT NULL,
        ema25 DECIMAL(20,8),
        rsi DECIMAL(10,4),
        confidence DECIMAL(5,2),
        strength VARCHAR(10),
        stop_loss DECIMAL(20,8),
        take_profit DECIMAL(20,8),
        risk_reward DECIMAL(10,4),
        atr DECIMAL(20,8),
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS trades (
        id BIGSERIAL PRIMARY KEY,
        signal_id BIGINT REFERENCES signals(id),
        strategy_id INTEGER REFERENCES strategies(id),
        strategy_name VARCHAR(100),
        timeframe VARCHAR(10) NOT NULL,
        signal_type VARCHAR(10) NOT NULL,
        entry_price DECIMAL(20,8) NOT NULL,
        stop_loss DECIMAL(20,8) NOT NULL,
        take_profit DECIMAL(20,8) NOT NULL,
        exit_price DECIMAL(20,8),
        status VARCHAR(20) DEFAULT 'OPEN',
        result VARCHAR(10),
        pnl_percent DECIMAL(10,4),
        confidence DECIMAL(5,2),
        risk_reward DECIMAL(10,4),
        opened_at TIMESTAMPTZ DEFAULT NOW(),
        closed_at TIMESTAMPTZ
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS account_settings (
        id INT DEFAULT 1 PRIMARY KEY,
        balance DECIMAL(20,8) DEFAULT 10000,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await client.query(
      `INSERT INTO account_settings (id, balance) VALUES (1, 10000) ON CONFLICT (id) DO NOTHING`
    );

    await client.query(`ALTER TABLE trades ADD COLUMN IF NOT EXISTS risk_amount DECIMAL(20,8)`);
    await client.query(`ALTER TABLE trades ADD COLUMN IF NOT EXISTS pnl_usd DECIMAL(20,8)`);
    await client.query(`ALTER TABLE strategies ADD COLUMN IF NOT EXISTS leverage INTEGER DEFAULT 1`);
    await client.query(`ALTER TABLE trades ADD COLUMN IF NOT EXISTS leverage INTEGER DEFAULT 1`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS risk_management (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        risk_percent DECIMAL(5,2) NOT NULL DEFAULT 1.0,
        stop_loss_percent DECIMAL(8,4) NOT NULL,
        take_profit_percent DECIMAL(8,4) NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await client.query(`ALTER TABLE strategies ADD COLUMN IF NOT EXISTS risk_management_id INTEGER REFERENCES risk_management(id) ON DELETE SET NULL`);

    await client.query(`CREATE INDEX IF NOT EXISTS idx_candles_tf_time ON candles(timeframe, open_time DESC)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_signals_created ON signals(created_at DESC)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_trades_status ON trades(status, opened_at DESC)`);

    // Apply improved strategy params (runs on every restart — idempotent)
    await client.query(`UPDATE strategies SET params = $1 WHERE type = 'EMA25_CROSSOVER'`,
      [JSON.stringify({ rrRatio: 2, atrMultiplierSL: 1.5, volumeFilter: true, minConfidence: 55 })]);
    await client.query(`UPDATE strategies SET params = $1 WHERE type = 'EMA25_BOUNCE' AND timeframe = '5m'`,
      [JSON.stringify({ rrRatio: 2, atrMultiplierSL: 0.3, minConfidence: 55 })]);
    await client.query(`UPDATE strategies SET params = $1 WHERE type = 'EMA25_RSI'`,
      [JSON.stringify({ rrRatio: 2.5, rsiOverbought: 65, rsiOversold: 35, atrMultiplierSL: 1.0, minConfidence: 60 })]);
    await client.query(`UPDATE strategies SET params = $1 WHERE type = 'EMA25_BOUNCE_1M'`,
      [JSON.stringify({ rrRatio: 2, atrMultiplierSL: 0.2, minConfidence: 65 })]);

    // Seed default strategies
    const { rows } = await client.query('SELECT COUNT(*) FROM strategies');
    if (parseInt(rows[0].count) === 0) {
      await client.query(`
        INSERT INTO strategies (name, type, timeframe, risk_percent, enabled, params) VALUES
        ('EMA25 Crossover 15m', 'EMA25_CROSSOVER', '15m', 1.0, true, '{"rrRatio":2,"atrMultiplierSL":1.5,"volumeFilter":true}'),
        ('EMA25 Bounce 5m', 'EMA25_BOUNCE', '5m', 1.0, true, '{"rrRatio":2,"atrMultiplierSL":0.5}'),
        ('EMA25 + RSI 1h', 'EMA25_RSI', '1h', 1.5, true, '{"rrRatio":2.5,"rsiOverbought":70,"rsiOversold":30}')
      `);
    }

    // Add 1m bounce strategy if not yet seeded
    await client.query(`
      INSERT INTO strategies (name, type, timeframe, risk_percent, enabled, params)
      SELECT 'EMA25 Bounce 1m', 'EMA25_BOUNCE_1M', '1m', 1.0, true,
             '{"rrRatio":2,"atrMultiplierSL":0.3,"touchThreshold":0.0005}'
      WHERE NOT EXISTS (SELECT 1 FROM strategies WHERE name = 'EMA25 Bounce 1m')
    `);

    console.log('Database initialized');
  } finally {
    client.release();
  }
}

export default pool;
