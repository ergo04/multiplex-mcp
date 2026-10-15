import { CopyButton } from "@/components/ui/copy-button"

export function CodeBlock({
  children,
  label,
}: {
  children: string
  label: string
}) {
  return (
    <div className="min-w-0 overflow-hidden rounded-lg border border-border">
      <div className="flex items-center justify-between gap-3 border-b border-border bg-muted px-4 py-2">
        <span className="min-w-0 truncate font-mono text-xs text-muted-foreground">
          {label}
        </span>
        <CopyButton text={children} />
      </div>
      <pre className="overflow-x-auto bg-muted/40 p-4 font-mono text-xs leading-relaxed text-foreground">
        <code>{children}</code>
      </pre>
    </div>
  )
}
