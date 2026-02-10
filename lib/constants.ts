// Tee time defaults
export const DEFAULT_MAX_PLAYERS_PER_TEE_TIME = 4

// Booking window defaults
export const DEFAULT_BOOKING_OPENS_DAYS_BEFORE = 7
export const DEFAULT_BOOKING_OPENS_TIME = "21:00" // 9 PM ET
export const DEFAULT_BOOKING_CLOSES_DAYS_BEFORE = 2
export const DEFAULT_BOOKING_CLOSES_TIME = "18:00" // 6 PM ET

// Player handicap range
export const MAX_STROKES_GIVEN = 20

// Course data for Long Beach Golf Course (18 holes)
export const COURSE_DATA = {
  holes: Array.from({ length: 18 }, (_, i) => i + 1),
  pars: [4, 4, 3, 4, 5, 3, 4, 4, 5, 3, 4, 4, 5, 4, 4, 3, 4, 5],
  whiteHdcp: [13, 9, 15, 5, 1, 17, 3, 11, 7, 12, 16, 2, 10, 8, 14, 18, 6, 4],
  frontNinePar: 36,
  backNinePar: 36,
  totalPar: 72,
} as const
