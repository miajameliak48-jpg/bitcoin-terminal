import { useTickerStore } from '../store';

function fmt(n: number, d = 2) {
  return n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
}

export default function Header() {
  const { ticker } = useTickerStore();

  const isUp = (ticker?.priceChangePercent ?? 0) >= 0;

  return (
    <header className="flex items-center gap-6 px-4 py-2 bg-panel border-b border-border shrink-0">
      <div className="flex items-center gap-2">
        <span className="text-ema font-bold text-lg">₿</span>
        <span className="text-text font-semibold">BTC/USDT</span>
      </div>

      {ticker ? (
        <>
          <span className={`text-2xl font-bold tabular-nums ${isUp ? 'text-buy' : 'text-sell'}`}>
            ${fmt(ticker.price)}
          </span>
          <span className={`text-sm ${isUp ? 'text-buy' : 'text-sell'}`}>
            {isUp ? '▲' : '▼'} {isUp ? '+' : ''}{fmt(ticker.priceChange)} ({isUp ? '+' : ''}{fmt(ticker.priceChangePercent)}%)
          </span>
          <div className="hidden md:flex items-center gap-4 text-xs text-muted ml-4">
            <span>H: <span className="text-text">${fmt(ticker.high24h)}</span></span>
            <span>L: <span className="text-text">${fmt(ticker.low24h)}</span></span>
            <span>Vol: <span className="text-text">{fmt(ticker.volume24h, 2)} BTC</span></span>
          </div>
        </>
      ) : (
        <span className="text-muted animate-pulse">Connecting...</span>
      )}

      <div className="ml-auto flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-buy animate-pulse" />
        <span className="text-xs text-muted">Live</span>
      </div>
    </header>
  );
}
