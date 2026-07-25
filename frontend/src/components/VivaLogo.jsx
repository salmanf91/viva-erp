/**
 * VivaLogo – Viva Studio brand mark.
 *
 * Renders the double-V (W-shaped) gold emblem with "VIVA STUDIO" text
 * beneath it in matching gold.
 *
 * Props:
 *   markSize  – height of the emblem in px (default 36)
 *   showText  – show "VIVA STUDIO" label below the mark (default true)
 *   className / style
 */
export default function VivaLogo({ markSize = 36, showText = true, className, style }) {
  const gid = 'viva-gold-grad';

  return (
    <div
      className={className}
      style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 4, ...style }}
    >
      {/* ── Emblem ── */}
      <svg
        width={markSize}
        height={markSize * 0.72}
        viewBox="0 0 120 86"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={gid} x1="50%" y1="0%" x2="50%" y2="100%">
            <stop offset="0%"   stopColor="#FFE87A" />
            <stop offset="50%"  stopColor="#C8860A" />
            <stop offset="100%" stopColor="#8B5500" />
          </linearGradient>
        </defs>
        {/*
          W shape — two V arms joined at a shared centre peak.

          Left V:   outer top-left (0,0) → valley (30,82) → centre peak (60,18)
          Right V:  centre peak (60,18) → valley (90,82) → outer top-right (120,0)
          Thickness achieved by an inner return path (6 px stroke-width look):

          Outer shell (clockwise):
            TL(0,0) → TR(120,0) → RValley(90,82) → Centre(60,18) → LValley(30,82) → back to TL

          Inner shell (offset inward ~12 px for thickness):
            TL(12,0) → LValley(30,68) → Centre(60,30) → RValley(90,68) → TR(108,0)
        */}
        <polygon
          points="0,0 120,0 90,82 60,18 30,82"
          fill={`url(#${gid})`}
        />
        {/* Cut out the inner area to give the W its leg thickness */}
        <polygon
          points="14,0 106,0 90,66 60,32 30,66"
          fill="#ffffff"
          style={{ mixBlendMode: 'normal' }}
        />
      </svg>

      {/* ── Label ── */}
      {showText && (
        <span style={{
          fontFamily: "'Segoe UI', system-ui, sans-serif",
          fontWeight: 800,
          fontSize: markSize * 0.38,
          letterSpacing: '0.12em',
          background: 'linear-gradient(160deg, #FFE87A 0%, #C8860A 60%, #8B5500 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          lineHeight: 1,
          textTransform: 'uppercase',
          whiteSpace: 'nowrap',
        }}>
          Viva Studio
        </span>
      )}
    </div>
  );
}
