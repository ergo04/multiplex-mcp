import { ClaudeCodeSection } from "@/components/sections/claude-code"
import { ConfigurationSection } from "@/components/sections/configuration"
import { FaqSection } from "@/components/sections/faq"
import { HeroSection } from "@/components/sections/hero"
import { HowItWorksSection } from "@/components/sections/how-it-works"
import { LimitsSection } from "@/components/sections/limits"
import { ProblemSection } from "@/components/sections/problem"
import { SecuritySection } from "@/components/sections/security"
import { ServicesSection } from "@/components/sections/services"
import { SetupSection } from "@/components/sections/setup"
import { SectionTimeline } from "@/components/ui/section-timeline"
import { CONTAINER } from "@/lib/layout"

export default function Page() {
  return (
    <>
      <HeroSection />
      <div
        className={`${CONTAINER} lg:grid lg:grid-cols-[11rem_minmax(0,1fr)] lg:gap-16 xl:grid-cols-[12rem_minmax(0,1fr)] xl:gap-20`}
      >
        <SectionTimeline />
        <div className="min-w-0">
          <ProblemSection />
          <HowItWorksSection />
          <SetupSection />
          <ClaudeCodeSection />
          <ServicesSection />
          <ConfigurationSection />
          <SecuritySection />
          <LimitsSection />
          <FaqSection />
        </div>
      </div>
    </>
  )
}
