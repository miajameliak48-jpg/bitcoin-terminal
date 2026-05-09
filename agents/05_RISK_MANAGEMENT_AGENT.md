# Agent 05 — Risk Management Agent

## Зона ответственности
Расчёт позиций, стопов, тейков. Защита капитала.

## Золотые правила

1. **Никогда не рискуй больше 1-2% от депозита за одну сделку**
2. **Минимальное соотношение Risk:Reward = 1:2**
3. **Максимальная просадка портфеля = 10%** (стоп торговли)
4. **Не более 3 открытых позиций одновременно**
5. **Стоп-лосс выставляется ДО входа в сделку**

## Формулы расчёта

### Размер позиции
```
RiskAmount = AccountBalance × RiskPercent / 100
StopDistance = EntryPrice - StopLossPrice  (для лонга)
PositionSize = RiskAmount / StopDistance   (в единицах BTC)
PositionValue = PositionSize × EntryPrice  (в USDT)
```

**Пример**:
```
Депозит: $10,000
Риск: 1% → $100
Вход: $95,000
Стоп: $94,000 → расстояние $1,000
Размер позиции: $100 / $1,000 = 0.1 BTC
Стоимость позиции: 0.1 × $95,000 = $9,500 (95% депозита — плечо 1:1)
```

### ATR-based стоп-лосс
```
ATR(14) — средний истинный диапазон за 14 периодов
TrueRange(i) = max(High-Low, |High-PrevClose|, |Low-PrevClose|)
ATR = SMA(TrueRange, 14)

Стоп для лонга:  Entry - ATR × multiplier (1.5 по умолчанию)
Стоп для шорта:  Entry + ATR × multiplier
```

### Тейк-профит
```
RR = 2.0  (минимальный Risk:Reward)
TakeProfit = Entry + (Entry - StopLoss) × RR  (для лонга)
TakeProfit = Entry - (StopLoss - Entry) × RR  (для шорта)
```

### Trailing Stop (сопровождение)
```
TrailingStop = max(
  InitialStop,
  CurrentPrice - ATR × 1.5  (для лонга)
)
// Обновляется при каждой новой свече
// Только движется в сторону прибыли, никогда назад
```

## Расчёт в API

```typescript
interface RiskCalculation {
  entryPrice: number;
  stopLossPrice: number;
  takeProfitPrice: number;
  positionSizeBTC: number;
  positionValueUSDT: number;
  riskAmountUSDT: number;
  riskPercent: number;
  potentialProfitUSDT: number;
  riskReward: number;
  leverageNeeded: number;
}

function calculateRisk(params: {
  accountBalance: number;    // USDT
  riskPercent: number;       // 1-2%
  entryPrice: number;
  stopLossPrice: number;
  rrRatio: number;           // 2.0 минимум
}): RiskCalculation
```

## Оценка качества сигнала

| Фактор | Вес |
|--------|-----|
| RR ≥ 3:1 | +20 |
| Стоп за уровнем поддержки/сопротивления | +15 |
| Объём подтверждает | +15 |
| EMA25 совпадает с направлением | +20 |
| RSI не в зоне перекупленности/перепроданности | +10 |
| Свеча с чётким направлением (пин-бар/маруботsu) | +20 |

**Порог для сделки**: ≥ 60 баллов

## Предупреждения (UI Alerts)
- 🔴 DANGER: Risk > 2% — отклонить сигнал
- 🟡 WARNING: RR < 2:1 — предупредить трейдера  
- 🟡 WARNING: 3 позиции уже открыты
- 🔴 DANGER: Просадка > 10% — заблокировать новые сигналы
- 🟡 WARNING: ATR в 2x выше нормы (высокая волатильность) — уменьшить размер

## Калькулятор позиции (UI компонент)

Пользователь вводит:
1. Размер депозита (USDT)
2. Риск на сделку (% или USDT)
3. Цена входа (подставляется автоматически из сигнала)
4. Цена стоп-лосса (подставляется из стратегии)
5. Желаемый RR

Вывод:
- Размер позиции в BTC
- Стоимость позиции в USDT
- Цена тейк-профита
- Максимальный убыток
- Потенциальная прибыль
