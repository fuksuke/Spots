/**
 * Time constants in milliseconds
 * Centralized to ensure consistency across the codebase
 */
export const MS = {
  SECOND: 1000,
  MINUTE: 60 * 1000,
  HOUR: 60 * 60 * 1000,
  DAY: 24 * 60 * 60 * 1000,
  WEEK: 7 * 24 * 60 * 60 * 1000,
} as const;

/**
 * Common time durations
 */
export const DURATIONS = {
  /** 24 hours in milliseconds */
  HOURS_24: 24 * MS.HOUR,

  /** 30 minutes in milliseconds */
  MINUTES_30: 30 * MS.MINUTE,

  /** 1 week in milliseconds */
  WEEK: MS.WEEK,

  /** 90 days in milliseconds */
  DAYS_90: 90 * MS.DAY,
} as const;

/**
 * Helper to add hours to current time
 */
export const addHours = (hours: number): Date => new Date(Date.now() + hours * MS.HOUR);

/**
 * Helper to add days to current time
 */
export const addDays = (days: number): Date => new Date(Date.now() + days * MS.DAY);
