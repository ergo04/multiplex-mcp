import type { ReactNode } from "react"

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="font-mono text-xs font-medium tracking-widest text-muted-foreground uppercase">
      {children}
    </p>
  )
}
