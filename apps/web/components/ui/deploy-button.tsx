import { DEPLOY_URL } from "@/lib/links"

export function DeployButton() {
  return (
    <a
      href={DEPLOY_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex shrink-0 rounded-md focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none"
    >
      {/* Cloudflare's own button, so it stays what people recognise. */}
      <img
        src="https://deploy.workers.cloudflare.com/button"
        alt="Deploy to Cloudflare"
        width={184}
        height={39}
        className="h-10 w-auto"
      />
    </a>
  )
}
