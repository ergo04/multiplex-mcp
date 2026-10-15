import type { ReactNode } from "react"
import { cn } from "@/lib/cn"
import { SectionLabel } from "@/components/ui/section-label"
import { sectionIndex } from "@/lib/sections"

export function Section({
  id,
  label,
  title,
  muted = false,
  children,
}: {
  id: string
  label: string
  title: string
  muted?: boolean
  children: ReactNode
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className={cn("border-b border-border/60", muted && "bg-muted/30")}
    >
      <div className="mx-auto max-w-3xl px-5 py-16 sm:px-6 sm:py-20">
        <SectionLabel index={sectionIndex(id)}>{label}</SectionLabel>
        <h2
          id={`${id}-title`}
          className="mt-4 text-2xl text-balance sm:text-3xl"
        >
          {title}
        </h2>
        <div className="mt-8 flex flex-col gap-6 text-sm leading-relaxed text-muted-foreground">
          {children}
        </div>
      </div>
    </section>
  )
}

export function Strong({ children }: { children: ReactNode }) {
  return <strong className="font-medium text-foreground">{children}</strong>
}

export function TextLink({
  href,
  children,
}: {
  href: string
  children: ReactNode
}) {
  const external = href.startsWith("http")
  return (
    <a
      href={href}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      className="text-foreground underline decoration-border underline-offset-4 transition-colors hover:decoration-foreground"
    >
      {children}
    </a>
  )
}
