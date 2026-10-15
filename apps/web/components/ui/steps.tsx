import type { ReactNode } from "react"

export function Steps({ children }: { children: ReactNode }) {
  return <ol className="flex flex-col gap-10">{children}</ol>
}

export function Step({
  number,
  title,
  children,
}: {
  number: number
  title: string
  children: ReactNode
}) {
  return (
    <li className="grid grid-cols-[1.75rem_minmax(0,1fr)] gap-x-4">
      <span
        aria-hidden
        className="flex size-7 items-center justify-center rounded-full border border-border bg-muted font-mono text-xs text-foreground"
      >
        {number}
      </span>
      <div className="flex min-w-0 flex-col gap-4">
        <h3 className="pt-0.5 text-base font-medium text-foreground">
          <span className="sr-only">Step {number}: </span>
          {title}
        </h3>
        {children}
      </div>
    </li>
  )
}
