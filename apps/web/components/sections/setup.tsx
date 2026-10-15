import { Code } from "@/components/ui/code"
import { DeployButton } from "@/components/ui/deploy-button"
import { Section, Strong } from "@/components/ui/section"
import { Step, Steps } from "@/components/ui/steps"
import { VarList } from "@/components/ui/var-list"

export function SetupSection() {
  return (
    <Section
      id="setup"
      label="Setup"
      title="From the Deploy button to your first connector"
      muted
    >
      <p>
        You need a Cloudflare account (the free plan is enough), a GitHub or
        GitLab account for the fork, and an API key for each account you want to
        connect.
      </p>

      <Steps>
        <Step number={1} title="Deploy the Worker">
          <div>
            <DeployButton />
          </div>
          <p>
            The button forks <Code>apps/gateway</Code> into your GitHub or
            GitLab account, creates the KV namespace that holds the OAuth
            grants, asks for the <Code>OWNER_PASSWORD</Code> secret, then builds
            and deploys. It deploys the gateway, not this site.
          </p>
          <p>
            Use a long random password, for example the output of{" "}
            <Code>openssl rand -base64 24</Code>, and keep it in your password
            manager. It is all that stands between the internet and every
            account behind the gateway.
          </p>
        </Step>

        <Step number={2} title="Add one secret per account">
          <p>
            In the Cloudflare dashboard open the Worker, then{" "}
            <Strong>Settings → Variables and Secrets</Strong>. For each account
            add a secret named{" "}
            <Code>ACCOUNT_&lt;SERVICE&gt;_&lt;ACCOUNT&gt;</Code> whose value is
            that account&apos;s API key.
          </p>
          <VarList
            label="Settings → Variables and Secrets"
            rows={[
              ["ACCOUNT_RESEND_WORK", "re_..."],
              ["ACCOUNT_RESEND_PERSONAL", "re_..."],
              ["ACCOUNT_LINEAR_ACME", "lin_api_..."],
            ]}
          />
          <p>
            Write the service and the account in uppercase letters and digits,
            starting with a letter, because the name is split on the
            underscores: <Code>ACCOUNT_RESEND_WORK</Code> works,{" "}
            <Code>ACCOUNT_RESEND_MY_WORK</Code> doesn&apos;t. The connector URL
            uses them in lowercase. A new secret takes effect without a
            redeploy.
          </p>
        </Step>

        <Step number={3} title="Copy the connector URLs">
          <p>
            Open the Worker&apos;s URL, for example{" "}
            <Code>
              https://multiaccount-mcp-gateway.&lt;your-subdomain&gt;.workers.dev
            </Code>
            , and sign in with the password. The page lists one connector URL
            per account, plus any configuration problem it found and which
            variable causes it.
          </p>
          <p>
            Signed out, the same page shows only how many connectors and
            problems there are. It never names a service, an account or a
            client.
          </p>
        </Step>

        <Step number={4} title="Add each URL to claude.ai">
          <p>
            In claude.ai open <Strong>Settings → Connectors</Strong>, click{" "}
            <Strong>Add custom connector</Strong>, paste one URL and leave{" "}
            <Strong>Advanced settings</Strong> empty. claude.ai opens the
            gateway&apos;s consent page: type the password and click{" "}
            <Strong>Allow</Strong>.
          </p>
          <p>
            A cookie remembers that browser for 30 days, so the next accounts
            take one click each. Repeat for every URL. The connectors then work
            in claude.ai on the web, on desktop and on mobile.
          </p>
        </Step>
      </Steps>
    </Section>
  )
}
