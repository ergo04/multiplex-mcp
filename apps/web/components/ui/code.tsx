import type { ReactNode } from "react"

// Paths and variable names have no spaces; without `wrap-anywhere` one of them
// is enough to push a phone screen sideways.
export function Code({ children }: { children: ReactNode }) {
  return (
    <code className="rounded-sm bg-muted px-1 py-0.5 font-mono text-[0.85em] wrap-anywhere text-foreground">
      {children}
    </code>
  )
}
