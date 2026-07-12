import { cn } from "@/lib/ui";

interface CointraqLogoProps {
  size?: number;
  className?: string;
  /** When true, strokes use currentColor (for themed UI). */
  themed?: boolean;
}

/**
 * Outline mark: coin ring + ledger ticks + tracking arc.
 * Stroke weights match lucide (1.75) for visual consistency with the shell.
 */
export function CointraqLogo({ size = 28, className, themed = true }: CointraqLogoProps) {
  const stroke = themed ? "currentColor" : "#3B77E8";
  const fill = themed ? "currentColor" : "#3B77E8";

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      className={cn("shrink-0", className)}
    >
      <circle cx="15" cy="17" r="9" stroke={stroke} strokeWidth="1.75" />
      <circle cx="15" cy="17" r="5.5" stroke={stroke} strokeWidth="1.25" strokeOpacity="0.4" />
      <path
        d="M11 14.5h8M11 17h5.5M11 19.5h3"
        stroke={stroke}
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M26 8.5 C22 4 18.5 3 15 3 C10 3 6 6 4 9"
        stroke={stroke}
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <circle cx="26" cy="8.5" r="2.25" fill={fill} />
    </svg>
  );
}
