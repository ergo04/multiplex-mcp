/** Reported to the model as a tool error, so it can correct the call. */
export class InvalidArguments extends Error {}

export type Arguments = Record<string, unknown>

export function requiredString(args: Arguments, key: string): string {
  const value = args[key]
  if (typeof value !== "string" || value === "")
    throw new InvalidArguments(`\`${key}\` must be a non-empty string`)
  return value
}

export function optionalString(
  args: Arguments,
  key: string
): string | undefined {
  return args[key] === undefined || args[key] === null || args[key] === ""
    ? undefined
    : requiredString(args, key)
}

export function requiredNumber(args: Arguments, key: string): number {
  const value = args[key]
  if (typeof value !== "number" || !Number.isFinite(value))
    throw new InvalidArguments(`\`${key}\` must be a number`)
  return value
}

export function optionalNumber(
  args: Arguments,
  key: string
): number | undefined {
  return args[key] === undefined || args[key] === null
    ? undefined
    : requiredNumber(args, key)
}

export function stringList(
  args: Arguments,
  key: string,
  max: number
): string[] {
  const value = args[key]
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    value.length > max ||
    !value.every((item) => typeof item === "string" && item !== "")
  )
    throw new InvalidArguments(
      `\`${key}\` must be a list of 1 to ${max} non-empty strings`
    )
  return value as string[]
}
