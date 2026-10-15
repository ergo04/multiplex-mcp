import { Code } from "@/components/ui/code"
import { Section, Strong, TextLink } from "@/components/ui/section"
import { DUPLICATE_URL_ISSUE } from "@/lib/links"

export function ProblemSection() {
  return (
    <Section
      id="problem"
      label="The problem"
      title="Why claude.ai takes only one account per service"
    >
      <p>
        I built this because I use more than one account of the same services,
        and claude.ai let me add only the first. Three things get in the way.
      </p>

      <ol className="grid gap-3 xl:grid-cols-3">
        <li className="rounded-lg border border-border bg-background p-4">
          <Strong>The same URL is refused.</Strong> claude.ai won&apos;t add a
          custom connector whose URL it already has (
          <TextLink href={DUPLICATE_URL_ISSUE}>
            anthropics/claude-ai-mcp#178
          </TextLink>
          , open as I write this). Two Resend accounts both live at{" "}
          <Code>https://mcp.resend.com/mcp</Code>.
        </li>
        <li className="rounded-lg border border-border bg-background p-4">
          <Strong>The connector form can&apos;t send headers.</Strong> It has a
          URL field and OAuth client fields, nothing else. So there&apos;s no
          way to tell one URL which API key to use.
        </li>
        <li className="rounded-lg border border-border bg-background p-4">
          <Strong>The query string trick is unreliable.</Strong> Adding{" "}
          <Code>?account=work</Code> makes the URL unique. It works with some
          OAuth servers and fails with others (Google and Zoho, for example),
          and one report says claude.ai drops the query when it calls the
          server.
        </li>
      </ol>

      <p>
        The gateway gets around all three. Every account gets a path of its own,
        so claude.ai sees different URLs. The gateway speaks OAuth to claude.ai
        itself, so no header is needed. And the account is in the path, not in
        the query.
      </p>
    </Section>
  )
}
