/** Strip a phone string down to digits only */
export function stripPhone(value: string): string {
  return value.replace(/\D/g, "")
}

/** Format a digit string as (XXX) XXX - XXXX */
export function formatPhone(value: string): string {
  const digits = stripPhone(value).slice(0, 10)
  if (digits.length === 0) return ""
  if (digits.length <= 3) return `(${digits}`
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)} - ${digits.slice(6)}`
}

/** Format for display — returns formatted string or empty */
export function displayPhone(stored: string | null): string {
  if (!stored) return ""
  return formatPhone(stored)
}

/** Validate that a stripped phone is exactly 10 US digits */
export function isValidPhone(digits: string): boolean {
  return /^\d{10}$/.test(digits)
}
