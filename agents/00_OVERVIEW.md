# Bitcoin Trading Terminal — Multi-Agent Architecture

## Цель проекта
Реальновременной биткоин-терминал с генерацией торговых стратегий на базе EMA25.

## Стек
- **Frontend**: React + TypeScript + Vite + TradingView Lightweight Charts
- **Backend**: Node.js + Express + TypeScript + Socket.IO
- **БД**: PostgreSQL (уже развернута на сервере)
- **Данные**: Binance WebSocket API (klines, ticker, depth)
- **Сервер**: Ubuntu @ 109.123.233.158
- **Proxy**: Nginx

## Агенты системы

| Агент | Файл | Зона ответственности |
|-------|------|----------------------|
| Infrastructure | 01_INFRASTRUCTURE_AGENT.md | Nginx, PM2, SSL, деплой |
| Backend | 02_BACKEND_AGENT.md | REST API, WebSocket proxy, БД |
| Frontend | 03_FRONTEND_AGENT.md | UI, графики, индикаторы |
| Strategy | 04_STRATEGY_AGENT.md | EMA25 стратегии, сигналы |
| Risk | 05_RISK_MANAGEMENT_AGENT.md | Позиционирование, стопы |

## Порты
- Frontend (Vite build): статика через Nginx
- Backend API: 3001 (internal)
- Nginx: 80/443 (public)
- PostgreSQL: 5432 (internal)

## Архитектурные принципы
1. **WebSocket for streaming** — Binance WS → Backend → Client (Socket.IO)
2. **REST for config** — стратегии, настройки, история
3. **Hybrid EMA approach** — EMA25 как основной фильтр тренда
4. **1-2% risk per trade** — жёсткое правило риска
5. **Real-time signals** — сигналы генерируются на каждой закрытой свече
