# Agent 03 — Frontend Agent

## Зона ответственности
React + TypeScript интерфейс торгового терминала.

## Стек
- React 18 + TypeScript + Vite
- TradingView Lightweight Charts (свечи + индикаторы)
- Socket.IO Client (real-time данные)
- Axios (REST запросы)
- Zustand (state management)
- Tailwind CSS (стилизация)

## Структура компонентов

```
frontend/src/
├── App.tsx
├── main.tsx
├── store/
│   ├── chartStore.ts       # Свечи, EMA, состояние графика
│   ├── signalStore.ts      # Сигналы и стратегии
│   └── tickerStore.ts      # Текущая цена, статистика
├── components/
│   ├── layout/
│   │   ├── Header.tsx      # Цена BTC, изменение 24h
│   │   └── Sidebar.tsx     # Навигация
│   ├── chart/
│   │   ├── TradingChart.tsx     # Основной график (свечи + EMA25)
│   │   ├── ChartControls.tsx    # Выбор таймфрейма
│   │   └── SignalMarkers.tsx    # Метки BUY/SELL на графике
│   ├── signals/
│   │   ├── SignalPanel.tsx      # Последние сигналы
│   │   └── SignalCard.tsx       # Карточка сигнала
│   ├── strategy/
│   │   ├── StrategyPanel.tsx    # Управление стратегиями
│   │   └── StrategyForm.tsx     # Создание/редактирование
│   ├── orderbook/
│   │   └── OrderBook.tsx        # Стакан ордеров
│   └── risk/
│       └── RiskCalculator.tsx   # Калькулятор позиции
├── hooks/
│   ├── useSocket.ts        # Socket.IO подключение
│   ├── useCandles.ts       # Загрузка и обновление свечей
│   └── useTicker.ts        # Real-time цена
├── services/
│   └── api.ts              # Axios API клиент
└── types/
    └── index.ts
```

## Ключевые UI элементы

### Главный экран (Desktop layout)
```
┌─────────────────────────────────────────────────────────┐
│  HEADER: BTC/USDT $95,420 ▲2.3%  [1m][5m][15m][1h][4h] │
├──────────────────────────────┬──────────────────────────┤
│                              │  SIGNALS PANEL           │
│   TRADING CHART              │  ● BUY  $95,200  EMA:... │
│   (Candlesticks + EMA25)     │  ○ SELL $94,800  ...     │
│                              │                          │
│                              ├──────────────────────────┤
│                              │  ORDER BOOK              │
│                              │  Ask: 95,450             │
│                              │  Bid: 95,410             │
├──────────────────────────────┴──────────────────────────┤
│  RISK CALCULATOR | STRATEGY MANAGER                      │
└─────────────────────────────────────────────────────────┘
```

### Цветовая схема (тёмная тема)
- Фон: #0d1117
- Панели: #161b22
- Бордер: #30363d
- Зелёный (BUY): #3fb950
- Красный (SELL): #f85149
- EMA линия: #ff9500 (оранжевый)
- Текст: #e6edf3
- Акцент: #1f6feb

### График
- Свечи с цветом вверх/вниз
- EMA25 — оранжевая линия поверх свечей
- Сигналы — треугольники BUY (▲ зелёный) / SELL (▼ красный)
- Объём — гистограмма внизу

## Ключевые принципы
- Обновление графика без полной перерисовки (update() а не setData())
- Дебounce для orderbook обновлений (max 10 раз/сек)
- Responsive: работает на 1024px+ экранах
- Все числа форматируются: цена 2 знака, volume 4 знака
