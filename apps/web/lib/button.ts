const BASE =
  "inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full border text-sm font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/40 [&_svg]:size-4 [&_svg]:shrink-0"

const VARIANTS = {
  default:
    "border-transparent bg-primary text-primary-foreground hover:bg-primary/85",
  outline: "border-border bg-background hover:bg-muted",
  ghost: "border-transparent hover:bg-muted",
}

const SIZES = {
  sm: "h-8 px-3",
  lg: "h-10 px-4",
  icon: "size-8",
}

export function buttonClass({
  variant = "default",
  size = "sm",
}: {
  variant?: keyof typeof VARIANTS
  size?: keyof typeof SIZES
} = {}) {
  return `${BASE} ${VARIANTS[variant]} ${SIZES[size]}`
}
