// Name/value pairs that would overflow a <pre> on a phone; here a row wraps.
export function VarList({
  label,
  rows,
  arrow = false,
}: {
  label: string
  rows: [name: string, value: string][]
  arrow?: boolean
}) {
  return (
    <div className="min-w-0 overflow-hidden rounded-lg border border-border">
      <p className="border-b border-border bg-muted px-4 py-2 font-mono text-xs text-muted-foreground">
        {label}
      </p>
      <dl className="divide-y divide-border bg-muted/40 font-mono text-xs leading-relaxed">
        {rows.map(([name, value]) => (
          <div
            key={name}
            className="flex flex-wrap gap-x-3 px-4 py-2 sm:grid sm:grid-cols-[12.5rem_minmax(0,1fr)]"
          >
            <dt className="wrap-anywhere text-foreground">{name}</dt>
            <dd className="wrap-anywhere text-muted-foreground">
              {arrow && <span aria-hidden>→ </span>}
              {value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
