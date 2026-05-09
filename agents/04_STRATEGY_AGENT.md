# Agent 04 — Strategy Agent

## Зона ответственности
Генерация и управление торговыми стратегиями на базе EMA25.

## Математика EMA

### Формула EMA
```
EMA(t) = Price(t) × k + EMA(t-1) × (1 - k)
k = 2 / (period + 1)

Для EMA25: k = 2 / (25 + 1) = 0.0769...
```

### Инициализация EMA25
- Первые 25 свечей: берём SMA(25) как стартовое значение
- После 25 свечей: применяем формулу рекурсивно
- Минимально нужно 50 свечей для стабильного EMA25

## Три стратегии на EMA25

---

### Стратегия 1: EMA25_CROSSOVER (Пересечение)
**Принцип**: Цена пересекает EMA25 — смена тренда

**BUY сигнал**:
```
Предыдущая свеча: close < EMA25
Текущая свеча:    close > EMA25
+ Volume текущей свечи > SMA(Volume, 20)  ← подтверждение объёмом
+ RSI(14) между 45 и 70                   ← не перекуплено
```

**SELL сигнал**:
```
Предыдущая свеча: close > EMA25
Текущая свеча:    close < EMA25
+ Volume > SMA(Volume, 20)
+ RSI(14) между 30 и 55
```

**Параметры**:
- Стоп-лосс: 1.5 × ATR(14) ниже/выше EMA25
- Тейк-профит: 3 × ATR(14) (RR = 2:1)
- Лучшие таймфреймы: 15m, 1h, 4h

---

### Стратегия 2: EMA25_BOUNCE (Отскок от EMA)
**Принцип**: В тренде цена возвращается к EMA25 как к поддержке

**Условие тренда (бычий)**:
```
EMA25(текущая) > EMA25(5 свечей назад)  ← EMA25 растёт
Price > EMA25                            ← цена выше EMA25
```

**BUY сигнал** (в бычьем тренде):
```
Low текущей свечи касается/проходит EMA25 (в пределах 0.1%)
Close > EMA25                            ← свеча закрылась выше
RSI(14) > 40                             ← не перепродан сильно
Свеча — bullish (close > open)           ← подтверждение
```

**SELL сигнал** (в медвежьем тренде — зеркально)**:
```
EMA25 падает
High касается EMA25 снизу
Close < EMA25
RSI(14) < 60
```

**Параметры**:
- Стоп-лосс: низ последней свечи - ATR(14) × 0.5
- Тейк-профит: предыдущий локальный хай/лоу или ATR × 2
- Лучшие таймфреймы: 5m, 15m, 1h

---

### Стратегия 3: EMA25_RSI (Комбо)
**Принцип**: EMA25 определяет тренд, RSI — точку входа

**BUY сигнал**:
```
Шаг 1: Price > EMA25 на 3+ свечах (тренд подтверждён)
Шаг 2: RSI(14) опускается ниже 45 (откат)
Шаг 3: RSI(14) разворачивается вверх (текущий RSI > предыдущий RSI)
Шаг 4: Price остаётся > EMA25
```

**SELL сигнал** (зеркально):
```
Price < EMA25 на 3+ свечах
RSI(14) поднимается выше 55
RSI(14) разворачивается вниз
Price остаётся < EMA25
```

**Параметры**:
- Стоп-лосс: EMA25 - ATR(14) × 1.0
- Тейк-профит: RSI достигает 65+ (для лонга) → закрытие
- Лучшие таймфреймы: 15m, 1h

---

## Confidence Score (0-100%)
Каждый сигнал получает оценку уверенности:

```typescript
function calculateConfidence(signal) {
  let score = 0;
  
  // Основные факторы (60%)
  if (emaAligned) score += 20;          // EMA25 в нужном направлении
  if (priceAboveBelow) score += 20;     // Цена по тренду
  if (rsiConfirms) score += 20;         // RSI подтверждает
  
  // Дополнительные факторы (40%)
  if (volumeAboveAvg) score += 15;      // Объём выше среднего
  if (candleStrong) score += 10;        // Сильная свеча (тело > 60% диапазона)
  if (noNearResistance) score += 15;    // Нет близкого уровня сопротивления
  
  return score; // 0-100
}
```

**Фильтр**: Сигналы с confidence < 50 — не показывать. Сигналы 50-70 — LOW, 70-85 — MEDIUM, 85+ — HIGH.

## Алгоритм запуска стратегий

```typescript
// Запускается на каждой ЗАКРЫТОЙ свече
async function onCandleClosed(candle: Candle, timeframe: string) {
  const candles = await getLastNCandles(timeframe, 100);
  const ema25 = calculateEMA(candles.map(c => c.close), 25);
  const rsi14 = calculateRSI(candles.map(c => c.close), 14);
  const atr14 = calculateATR(candles, 14);
  
  const activeStrategies = await getEnabledStrategies(timeframe);
  
  for (const strategy of activeStrategies) {
    const signal = runStrategy(strategy.type, {
      candles, ema25, rsi14, atr14, currentCandle: candle
    });
    
    if (signal && signal.confidence >= 50) {
      await saveSignal(signal);
      emitToClients('signal:new', signal);
    }
  }
}
```

## Бэктестинг
При создании стратегии запускается быстрый бэктест на последних 500 свечах:
- Win rate %
- Avg profit per trade
- Max drawdown
- Profit factor
- Sharpe ratio (упрощённый)
