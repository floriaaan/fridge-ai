import type { ReactNode } from 'react'

/** A hand-drawn lime stroke under a few words of a display heading. */
export function ScribbleUnderline({ children }: { children: ReactNode }) {
  return (
    <span className="relative inline-block">
      <svg
        aria-hidden
        viewBox="0 0 300 30"
        preserveAspectRatio="none"
        className="pointer-events-none absolute inset-x-0 -bottom-3 h-5 w-full text-blob-strong"
      >
        <path
          d="M 6 20 C 60 6 110 26 160 14 C 210 4 250 22 294 10"
          fill="none"
          stroke="currentColor"
          strokeWidth="9"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <span className="relative">{children}</span>
    </span>
  )
}
