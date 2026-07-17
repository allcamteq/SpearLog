/** Hand-drawn line-art spearfishing & sea-life motifs — all `currentColor` so they inherit whatever text color/opacity the caller sets, keeping them theme-aware. */

export function FishShape({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M2 12c5-6 11-9 18-9s14 4 20 9c-6 5-13 9-20 9S7 18 2 12Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <circle cx="34" cy="10" r="1.4" fill="currentColor" />
      <path d="M2 12c0-2.8 1.2-4.4 2.8-5.6M2 12c0 2.8 1.2 4.4 2.8 5.6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

export function BubblesShape({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 40" fill="none" className={className} aria-hidden="true">
      <circle cx="12" cy="34" r="3.2" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="6" cy="20" r="2.1" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="15" cy="9" r="1.4" stroke="currentColor" strokeWidth="1.1" />
    </svg>
  );
}

export function WaveShape({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 16" fill="none" className={className} aria-hidden="true" preserveAspectRatio="none">
      <path
        d="M0 8c8-6 16-6 24 0s16 6 24 0 16-6 24 0 16 6 24 0 16-6 24 0"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function SpeargunShape({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 20" fill="none" className={className} aria-hidden="true">
      <path d="M2 14h34" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M36 14 60 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M50 6.5 60 3l-2 6.5" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M2 8v12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M8 14v5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

/** A long freedive fin — closed foot pocket + a long tapering blade. */
export function FinShape({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 72 16" fill="none" className={className} aria-hidden="true">
      <path
        d="M2 8c0-3.3 2.7-6 6-6h5c1.7 0 3 1.3 3 3v6c0 1.7-1.3 3-3 3H8c-3.3 0-6-2.7-6-6Z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <path
        d="M16 5.5c18-3 36-3 54 2.5-18 5.5-36 5.5-54 2.5-.8-1.6-.8-3.4 0-5Z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <path d="M20 8h48" stroke="currentColor" strokeWidth="0.9" strokeLinecap="round" />
    </svg>
  );
}

/** A dive mask — two lens frames, a nose bridge, and strap curls. */
export function MaskShape({ className }: { className?: string }) {
  return (
    <svg viewBox="-7 0 48 22" fill="none" className={className} aria-hidden="true">
      <rect x="2" y="2" width="14" height="16" rx="7" stroke="currentColor" strokeWidth="1.3" />
      <rect x="18" y="2" width="14" height="16" rx="7" stroke="currentColor" strokeWidth="1.3" />
      <path d="M16 10h2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M2 9c-3 .3-5 1.4-5 3.5M32 9c3 .3 5 1.4 5 3.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
    </svg>
  );
}

/** A snorkel — straight tube, purge valve, curving into a mouthpiece. */
export function SnorkelShape({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 22 40" fill="none" className={className} aria-hidden="true">
      <path d="M7 2v21c0 3 1.7 4.3 4.5 6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="7" cy="11" r="2.1" stroke="currentColor" strokeWidth="1.1" />
      <ellipse cx="15.5" cy="31.5" rx="4" ry="2.6" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}

/** A crab — round body, raised pincers, and legs. */
export function CrabShape({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 30" fill="none" className={className} aria-hidden="true">
      <ellipse cx="20" cy="17" rx="13" ry="8.5" stroke="currentColor" strokeWidth="1.3" />
      <path d="M9 11c-3-3.3-6.5-3.6-9-1.8M31 11c3-3.3 6.5-3.6 9-1.8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <circle cx="1.6" cy="7.3" r="2" stroke="currentColor" strokeWidth="1" />
      <circle cx="38.4" cy="7.3" r="2" stroke="currentColor" strokeWidth="1" />
      <circle cx="14" cy="15" r="1.1" fill="currentColor" />
      <circle cx="26" cy="15" r="1.1" fill="currentColor" />
      <path
        d="M10 23c-2.5 1.3-4 3.3-5 6M15 25c-1.6 2-2.4 4-2.6 6.5M25 25c1.6 2 2.4 4 2.6 6.5M30 23c2.5 1.3 4 3.3 5 6"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** A five-point starfish. */
export function StarfishShape({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 30" fill="none" className={className} aria-hidden="true">
      <path
        d="M16 2 19.5 11.2 29.3 11.7 21.7 17.9 24.2 27.3 16 22 7.8 27.3 10.3 17.9 2.7 11.7 12.5 11.2Z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <circle cx="16" cy="15" r="1" fill="currentColor" />
    </svg>
  );
}

/** A jellyfish — domed bell with trailing tentacles. */
export function JellyfishShape({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 34" fill="none" className={className} aria-hidden="true">
      <path
        d="M4 15C4 8 9.4 3 16 3s12 5 12 12c0 2.2-1.8 3-1.8 3H5.8S4 17.2 4 15Z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <path d="M8 18c0 3-2 3-2 6.5s2 3.5 2 7" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
      <path d="M14 18c0 3.3-1.5 3.3-1.5 7s1.5 3.8 1.5 7.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
      <path d="M20 18c0 3.3 1.5 3.3 1.5 7s-1.5 3.8-1.5 7.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
      <path d="M26 18c0 3-2 3-2 6.5s2 3.5 2 7" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
    </svg>
  );
}

/** A scallop shell fan. */
export function ShellShape({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 22" fill="none" className={className} aria-hidden="true">
      <path d="M16 2c8.5 0 15 8 15 18H1C1 10 7.5 2 16 2Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <path
        d="M16 2v18M9.5 3.6v16.4M22.5 3.6v16.4M4.5 7.5V20M27.5 7.5V20"
        stroke="currentColor"
        strokeWidth="0.9"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** A ship's anchor. */
export function AnchorShape({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 32" fill="none" className={className} aria-hidden="true">
      <circle cx="12" cy="4" r="2.6" stroke="currentColor" strokeWidth="1.3" />
      <path d="M12 6.6V27" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M4 13h16" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <path
        d="M4 21c0 4 3.5 6.5 8 6.5M20 21c0 4-3.5 6.5-8 6.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** A diver silhouette streamlined toward a forked monofin tail (the fork is what reads as "diver" rather than a stray line). */
export function DiverShape({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 46 20" fill="none" className={className} aria-hidden="true">
      <circle cx="6" cy="7" r="3.4" stroke="currentColor" strokeWidth="1.3" />
      <path d="M9 8c8 1 16 2.5 22 5.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path
        d="M31 13.5c3-2.5 7-3 11-1.5-2 3-5 5-9 5.3-1.6-.8-2.4-2-2-3.8Z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <path
        d="M31 13.5c3.3.3 6.6 2 8.5 5-4 .6-8-.3-10.5-3.2-.2-.8 0-1.4 2-1.8Z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Fixed, full-viewport, low-opacity tiled backdrop of dive/spearfishing motifs. Purely visual — sits behind page content and never intercepts clicks. Icons are black-on-transparent, so dark mode inverts them to read as light-on-dark. */
export function OceanBackground() {
  return (
    <div
      className="pointer-events-none fixed inset-0 -z-10 opacity-[0.05] dark:opacity-[0.04] dark:invert"
      style={{
        backgroundImage: "url(/ocean-pattern.png)",
        backgroundRepeat: "repeat",
        backgroundSize: "480px",
      }}
      aria-hidden="true"
    />
  );
}
