import type { Metadata } from "next"
import { buttonClass } from "@/lib/button"
import { SectionLabel } from "@/components/ui/section-label"

export const metadata: Metadata = {
  title: "Not found · multiaccount-mcp-gateway",
}

export default function NotFound() {
  return (
    <section className="mx-auto flex max-w-3xl flex-col items-start gap-6 px-5 py-24 sm:px-6">
      <SectionLabel>404</SectionLabel>
      <h1 className="text-3xl">Nothing at this address</h1>
      <p className="text-sm leading-relaxed text-muted-foreground">
        If you were looking for a connector URL, those live on your own gateway,
        not on this site. This one only has the docs.
      </p>
      <a href="/" className={buttonClass({ size: "lg" })}>
        Back to the docs
      </a>
    </section>
  )
}
