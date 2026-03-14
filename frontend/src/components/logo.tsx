"use client";

interface LogoMarkProps {
  size?: number;
  className?: string;
}

/** AstraSend logo mark — a globe with a departing arrow, representing cross-border money transfers. */
export function LogoMark({ size = 32, className }: LogoMarkProps) {
  return (
    <div
      className={`flex items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 ${className ?? ""}`}
      style={{ width: size, height: size, minWidth: size }}
    >
      <svg
        width={size * 0.75}
        height={size * 0.75}
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        {/* Globe circle */}
        <circle cx="10" cy="12" r="7" stroke="white" strokeWidth="1.6" />
        {/* Equator — slight curve for depth */}
        <path
          d="M3 12 Q10 15 17 12"
          stroke="white"
          strokeWidth="1.1"
          fill="none"
          strokeLinecap="round"
        />
        {/* Meridian — vertical curve biased right for perspective */}
        <path
          d="M10 5 Q13 12 10 19"
          stroke="white"
          strokeWidth="1.1"
          fill="none"
          strokeLinecap="round"
        />
        {/* Outbound arrow — "sending" money out of the globe */}
        <path
          d="M17 12 L23 12"
          stroke="white"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
        <path
          d="M20 9 L23 12 L20 15"
          stroke="white"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </svg>
    </div>
  );
}
