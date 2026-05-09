import { useEffect } from 'react';

interface Props {
  onDone: () => void;
}

const SMOKE_PUFFS = [
  { tx: -320, ty: -200, size: 280, delay: 0,    opacity: 0.55 },
  { tx:  300, ty: -180, size: 320, delay: 0.08, opacity: 0.5  },
  { tx: -340, ty:  160, size: 260, delay: 0.14, opacity: 0.45 },
  { tx:  310, ty:  170, size: 300, delay: 0.06, opacity: 0.5  },
  { tx:   20, ty: -360, size: 240, delay: 0.18, opacity: 0.4  },
  { tx:   10, ty:  340, size: 270, delay: 0.1,  opacity: 0.45 },
  { tx: -180, ty:  300, size: 220, delay: 0.2,  opacity: 0.38 },
  { tx:  240, ty:  290, size: 250, delay: 0.05, opacity: 0.42 },
  { tx: -260, ty:   30, size: 200, delay: 0.22, opacity: 0.35 },
  { tx:  290, ty:   10, size: 210, delay: 0.13, opacity: 0.38 },
];

export default function ChartExplosion({ onDone }: Props) {
  useEffect(() => {
    const t = setTimeout(onDone, 5000);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div className="fixed inset-0 z-50 pointer-events-none overflow-hidden flex items-center justify-center">

      {/* Bright inner core */}
      <div
        className="absolute rounded-full tf-flash-core"
        style={{
          width: 60,
          height: 60,
          background: 'radial-gradient(circle, #fff 0%, #ffe066 30%, #ff9500 60%, transparent 100%)',
        }}
      />

      {/* Mid flash halo */}
      <div
        className="absolute rounded-full tf-flash-halo"
        style={{
          width: 160,
          height: 160,
          background: 'radial-gradient(circle, rgba(255,200,60,0.8) 0%, rgba(255,100,20,0.4) 50%, transparent 100%)',
        }}
      />

      {/* Shockwave ring 1 */}
      <div
        className="absolute rounded-full tf-shockwave-1"
        style={{ width: 80, height: 80, border: '10px solid rgba(255,160,40,0.85)' }}
      />

      {/* Shockwave ring 2 */}
      <div
        className="absolute rounded-full tf-shockwave-2"
        style={{ width: 80, height: 80, border: '5px solid rgba(255,220,80,0.65)' }}
      />

      {/* Shockwave ring 3 — large, faint */}
      <div
        className="absolute rounded-full tf-shockwave-3"
        style={{ width: 80, height: 80, border: '2px solid rgba(255,255,200,0.35)' }}
      />

      {/* Smoke puffs */}
      {SMOKE_PUFFS.map((p, i) => (
        <div
          key={i}
          className="absolute rounded-full tf-smoke"
          style={{
            width: p.size,
            height: p.size,
            animationDelay: `${p.delay}s`,
            '--tx': `${p.tx}px`,
            '--ty': `${p.ty}px`,
            '--op': p.opacity,
            background: `radial-gradient(circle, rgba(60,60,70,${p.opacity}) 0%, rgba(40,40,50,${p.opacity * 0.6}) 50%, transparent 80%)`,
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
}
