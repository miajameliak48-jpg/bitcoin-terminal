# Agent 02 — Backend Agent

## Зона ответственности
Node.js + Express + Socket.IO сервер. Прокси Binance WebSocket. REST API. PostgreSQL.

## Архитектура

```
backend/src/
├── index.ts              # Точка входа, Express + Socket.IO
├── config/
│   └── db.ts             # PostgreSQL подключение (pg pool)
├── routes/
│   ├── candles.ts        # GET /api/candles — история свечей
│   ├── strategies.ts     # CRUD /api/strategies
│   └── signals.ts        # GET /api/signals — история сигналов
├── services/
│   ├── binanceWs.ts      # Binance WebSocket клиент
│   ├── candleStore.ts    # Буфер последних свечей в памяти
│   └── strategyRunner.ts # Запуск стратегий на каждой свече
├── indicators/
│   ├── ema.ts            # EMA расчёт
│   └── rsi.ts            # RSI расчёт
└── types/
    └── index.ts          # Общие типы (Candle, Signal, Strategy)
```

## Binance WebSocket потоки
```
wss://stream.binance.com:9443/ws/btcusdt@kline_1m
wss://stream.binance.com:9443/ws/btcusdt@kline_5m
wss://stream.binance.com:9443/ws/btcusdt@kline_15m
wss://stream.binance.com:9443/ws/btcusdt@kline_1h
wss://stream.binance.com:9443/ws/btcusdt@ticker (24h stats)
wss://stream.binance.com:9443/ws/btcusdt@depth20 (order book)
```

## PostgreSQL схема

```sql
-- Свечи
CREATE TABLE candles (
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
);

-- Торговые сигналы
CREATE TABLE signals (
  id BIGSERIAL PRIMARY KEY,
  strategy_id INTEGER REFERENCES strategies(id),
  timeframe VARCHAR(10) NOT NULL,
  signal_type VARCHAR(10) NOT NULL,  -- 'BUY' | 'SELL' | 'HOLD'
  price DECIMAL(20,8) NOT NULL,
  ema25 DECIMAL(20,8),
  rsi DECIMAL(10,4),
  confidence DECIMAL(5,2),           -- 0-100%
  stop_loss DECIMAL(20,8),
  take_profit DECIMAL(20,8),
  risk_reward DECIMAL(10,4),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Стратегии
CREATE TABLE strategies (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  type VARCHAR(50) NOT NULL,         -- 'EMA25_CROSSOVER' | 'EMA25_BOUNCE' | 'EMA25_RSI'
  timeframe VARCHAR(10) NOT NULL,
  risk_percent DECIMAL(5,2) DEFAULT 1.0,
  enabled BOOLEAN DEFAULT TRUE,
  params JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Socket.IO события (сервер → клиент)
- `candle:update` — новая/обновлённая свеча
- `signal:new` — новый торговый сигнал
- `ticker:update` — текущая цена и 24h статистика
- `orderbook:update` — стакан ордеров
- `ema:update` — текущее значение EMA25

## REST API
```
GET  /api/candles?timeframe=5m&limit=200   → история свечей
GET  /api/signals?limit=50                 → последние сигналы
GET  /api/strategies                       → список стратегий
POST /api/strategies                       → создать стратегию
PUT  /api/strategies/:id                   → обновить стратегию
GET  /api/ticker                           → текущая цена BTC
```

## Ключевые принципы
- EMA пересчитывается при каждом обновлении свечи
- Сигналы генерируются только на **закрытых** свечах (is_closed = true)
- Буфер последних 500 свечей держится в памяти для скорости
- Reconnect к Binance с exponential backoff (1s → 2s → 4s → 30s max)
