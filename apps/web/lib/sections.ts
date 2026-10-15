/** Page order: the hero's contents list and the numbered labels both read it. */
export const SECTIONS = [
  { id: "problem", label: "The problem" },
  { id: "how-it-works", label: "How it works" },
  { id: "setup", label: "Setup" },
  { id: "claude-code", label: "Claude Code" },
  { id: "services", label: "Services" },
  { id: "configuration", label: "Configuration" },
  { id: "security", label: "Security" },
  { id: "limits", label: "Limits" },
  { id: "faq", label: "FAQ" },
]

export function sectionIndex(id: string): number | undefined {
  const index = SECTIONS.findIndex((section) => section.id === id)
  return index === -1 ? undefined : index + 1
}
