export const MIN_HANDICAP = -10
export const MAX_HANDICAP = 54

export function formatHandicapInput(value: string): string {
  let cleaned = value.replace(/[^\d.\-]/g, "")
  const negative = cleaned.startsWith("-")
  cleaned = cleaned.replace(/-/g, "")

  const firstDot = cleaned.indexOf(".")
  if (firstDot !== -1) {
    cleaned =
      cleaned.slice(0, firstDot + 1) + cleaned.slice(firstDot + 1).replace(/\./g, "")
  }

  if (firstDot !== -1) {
    const [whole, decimal = ""] = cleaned.split(".")
    cleaned = `${whole}.${decimal.slice(0, 1)}`
  }

  return negative ? `-${cleaned}` : cleaned
}

export function parseHandicap(value: string): number | null {
  if (value === "" || value === "-" || value === ".") return null
  const num = Number(value)
  if (Number.isNaN(num)) return null
  return Math.round(num * 10) / 10
}

export function isValidHandicap(value: number): boolean {
  return value >= MIN_HANDICAP && value <= MAX_HANDICAP
}

export function displayHandicap(stored: number | null | undefined): string {
  if (stored === null || stored === undefined) return ""
  return stored.toFixed(1)
}
