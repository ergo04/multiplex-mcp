/**
 * mupx's mark: three bars join one spine and one leaves. The way out carries
 * the single accent, as the brand keeps orange for actions.
 */
export function MupxMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 256 256" aria-hidden className={className}>
      <path
        fill="currentColor"
        d="M41 44H167A9 9 0 0 1 176 53V203A9 9 0 0 1 167 212H41A9 9 0 0 1 32 203V185A9 9 0 0 1 41 176H140V146H41A9 9 0 0 1 32 137V119A9 9 0 0 1 41 110H140V80H41A9 9 0 0 1 32 71V53A9 9 0 0 1 41 44Z"
      />
      <path
        className="fill-primary"
        d="M176 110H215A9 9 0 0 1 224 119V137A9 9 0 0 1 215 146H176Z"
      />
    </svg>
  )
}
