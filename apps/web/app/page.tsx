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

export default function Page() {
  return (
    <>
      <HeroSection />
      <ProblemSection />
      <HowItWorksSection />
      <SetupSection />
      <ClaudeCodeSection />
      <ServicesSection />
      <ConfigurationSection />
      <SecuritySection />
      <LimitsSection />
      <FaqSection />
    </>
  )
}
