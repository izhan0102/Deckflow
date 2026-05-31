"use client";
import Link from "next/link";

/**
 * EZdeck brand mark. A rounded gradient tile with the "EZ" wordmark
 * stacked tightly inside, paired with the wordmark in display weight.
 *
 * Use the `compact` variant for sidebars / tight headers, `full` for
 * landing-page headers, footers, and any place the brand needs to be
 * read at a glance.
 */

export type LogoSize = "sm" | "md" | "lg";

const SIZES: Record<LogoSize, { mark: number; gap: number; word: string; markText: number }> = {
  sm: { mark: 26, gap: 8,  word: "text-[13px]", markText: 11 },
  md: { mark: 32, gap: 10, word: "text-[15px]", markText: 13 },
  lg: { mark: 44, gap: 14, word: "text-[20px]", markText: 18 },
};

export default function Logo({
  size = "md",
  variant = "full",
  href = "/",
  className = "",
  white = false,
}: {
  size?: LogoSize;
  variant?: "full" | "mark";
  href?: string | null;
  className?: string;
  /** When true, wordmark renders white (use on dark backgrounds). */
  white?: boolean;
}) {
  const cfg = SIZES[size];

  const inner = (
    <span
      className={`inline-flex items-center ${className}`}
      style={{ gap: cfg.gap }}
      aria-label="EZdeck"
    >
      <Mark size={cfg.mark} fontSize={cfg.markText} />
      {variant === "full" && (
        <span
          className={`${cfg.word} font-semibold tracking-tight`}
          style={{ color: white ? "#fff" : "var(--ezd-fg-strong)" }}
        >
          EZ<span style={{ opacity: 0.7 }}>deck</span>
        </span>
      )}
    </span>
  );

  if (!href) return inner;
  return <Link href={href} className="inline-flex items-center">{inner}</Link>;
}

/* The "EZ" tile. SVG so it scales crisply at any size. Monochrome: the
   tile fills with the theme foreground (white on black, black on white)
   and the letters punch through in the page background color. */
function Mark({ size, fontSize }: { size: number; fontSize: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role="img"
      aria-hidden
      style={{ display: "block", flexShrink: 0 }}
    >
      {/* Rounded tile in the theme foreground color */}
      <rect width="64" height="64" rx="14" fill="var(--ezd-fg-strong)" />

      {/* "E" — three short bars, drawn in the page background color so they
          read as cut-outs of the tile. */}
      <g
        fill="none"
        stroke="var(--ezd-bg-page)"
        strokeWidth="5.5"
        strokeLinecap="round"
      >
        <line x1="14" y1="22" x2="34" y2="22" />
        <line x1="14" y1="32" x2="28" y2="32" />
        <line x1="14" y1="42" x2="34" y2="42" />
      </g>

      {/* "Z" — diagonal, same cut-out treatment. */}
      <path
        d="M 38 22 L 50 22 L 38 42 L 50 42"
        fill="none"
        stroke="var(--ezd-bg-page)"
        strokeWidth="5.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
