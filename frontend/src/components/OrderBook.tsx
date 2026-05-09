import { useOrderBookStore, useTickerStore } from '../store';

function fmt(n: number, d = 2) {
  return n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
}

export default function OrderBook() {
  const { orderBook } = useOrderBookStore();
  const { ticker } = useTickerStore();

  if (!orderBook) {
    return (
      <div className="p-3 text-center text-muted text-xs">
        <div className="animate-pulse">Loading order book...</div>
      </div>
    );
  }

  const maxVol = Math.max(
    ...orderBook.asks.map(a => a.quantity),
    ...orderBook.bids.map(b => b.quantity)
  );

  const spread = orderBook.asks.length && orderBook.bids.length
    ? orderBook.asks[0].price - orderBook.bids[0].price
    : 0;

  return (
    <div className="flex flex-col h-full text-xs">
      <div className="px-3 py-2 border-b border-border">
        <span className="text-sm font-semibold text-text">Order Book</span>
        {spread > 0 && (
          <span className="ml-2 text-muted">Spread: ${fmt(spread, 2)}</span>
        )}
      </div>

      <div className="flex px-2 py-1 text-muted text-[10px]">
        <span className="flex-1">Price (USDT)</span>
        <span>Size (BTC)</span>
      </div>

      {/* Asks (sells) — red, shown top to bottom descending */}
      <div className="flex-1 overflow-hidden">
        {[...orderBook.asks].reverse().slice(0, 10).map((ask, i) => (
          <div key={i} className="relative flex px-2 py-[2px] hover:bg-white/5">
            <div
              className="absolute right-0 top-0 h-full bg-sell/10"
              style={{ width: `${(ask.quantity / maxVol) * 100}%` }}
            />
            <span className="flex-1 text-sell tabular-nums">{fmt(ask.price, 2)}</span>
            <span className="text-muted tabular-nums">{fmt(ask.quantity, 4)}</span>
          </div>
        ))}
      </div>

      {/* Mid price */}
      <div className="py-1.5 px-2 border-y border-border text-center">
        <span className={`font-bold tabular-nums ${(ticker?.priceChangePercent ?? 0) >= 0 ? 'text-buy' : 'text-sell'}`}>
          ${ticker ? fmt(ticker.price) : '—'}
        </span>
      </div>

      {/* Bids (buys) — green */}
      <div className="flex-1 overflow-hidden">
        {orderBook.bids.slice(0, 10).map((bid, i) => (
          <div key={i} className="relative flex px-2 py-[2px] hover:bg-white/5">
            <div
              className="absolute right-0 top-0 h-full bg-buy/10"
              style={{ width: `${(bid.quantity / maxVol) * 100}%` }}
            />
            <span className="flex-1 text-buy tabular-nums">{fmt(bid.price, 2)}</span>
            <span className="text-muted tabular-nums">{fmt(bid.quantity, 4)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
