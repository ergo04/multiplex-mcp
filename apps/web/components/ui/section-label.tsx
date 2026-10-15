import type { ReactNode } from "react"

/** The brand's label: index in ink, a small orange square, sentence case. */
export function SectionLabel({
  index,
  children,
}: {
  index?: number
  children: ReactNode
}) {
  return (
    <p className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
      <span aria-hidden className="size-1.5 shrink-0 bg-primary" />
      {index !== undefined && (
        <span className="text-foreground tabular-nums">
          {String(index).padStart(2, "0")}.
        </span>
      )}
      {children}
    </p>
  )
}
