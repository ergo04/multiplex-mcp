import type { ReactNode } from "react"

export function Badge({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-[6px] border border-border bg-card px-2 py-0.5 text-xs font-medium whitespace-nowrap text-muted-foreground">
      {children}
    </span>
  )
}
