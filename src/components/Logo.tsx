interface LogoProps {
  compact?: boolean;
}

export function VlogSparkLogo({ compact = false }: LogoProps) {
  return (
    <span className="inline-flex items-center gap-2.5 whitespace-nowrap shrink-0 select-none">
      <svg
        width="30"
        height="30"
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        className="shrink-0"
      >
        <defs>
          <linearGradient id="vsGrad" x1="2" y1="2" x2="30" y2="30" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#3B82F6" />
            <stop offset="100%" stopColor="#7C3AED" />
          </linearGradient>
        </defs>
        <rect x="1.5" y="1.5" width="29" height="29" rx="8" fill="url(#vsGrad)" />
        {/* Crisp Play Triangle */}
        <path d="M12.2 10.3L21.4 16L12.2 21.7V10.3Z" fill="#FFFFFF" />
        {/* Clean Spark Star Accent */}
        <path
          d="M24.2 6.5L25 8.5L27 9.3L25 10.1L24.2 12.1L23.4 10.1L21.4 9.3L23.4 8.5L24.2 6.5Z"
          fill="#E0E7FF"
        />
      </svg>
      {!compact && (
        <span className="font-display text-lg font-bold tracking-tight text-white">
          VlogSpark AI
        </span>
      )}
    </span>
  );
}
