import type { ReactNode } from "react"

export function Badge({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-border bg-muted px-2.5 py-0.5 font-mono text-xs whitespace-nowrap text-muted-foreground">
      {children}
    </span>
  )
}
