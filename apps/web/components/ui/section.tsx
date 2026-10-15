import type { ReactNode } from "react"
import { SectionLabel } from "@/components/ui/section-label"
import { sectionIndex } from "@/lib/sections"

/**
 * One band of the docs column. Every block inside takes the column's full
 * width, so all edges line up; the column itself is sized for reading.
 */
export function Section({
  id,
  label,
  title,
  children,
}: {
  id: string
  label: string
  title: string
  children: ReactNode
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className="scroll-mt-16 border-t border-border py-16 first:border-t-0 sm:py-20"
    >
      <SectionLabel index={sectionIndex(id)}>{label}</SectionLabel>
      <h2 id={`${id}-title`} className="mt-3 text-2xl text-balance sm:text-3xl">
        {title}
      </h2>
      {/* Sub-headings that sit straight in the column mark a new topic, so they
          get the display face; ones inside cards and steps keep their own. */}
      <div className="mt-8 flex flex-col gap-7 text-[0.9375rem] leading-7 text-prose [&>h3]:pt-6 [&>h3]:font-display [&>h3]:text-xl [&>h3]:font-semibold [&>h3]:tracking-tight [&>h3]:text-foreground">
        {children}
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
