/**
 * Date utility functions for form handling
 */

/**
 * Converts a Date object to a datetime-local input value string.
 * Adjusts for timezone offset to display local time correctly.
 *
 * @param date - Date object to convert
 * @returns String in format "YYYY-MM-DDTHH:mm" suitable for datetime-local input
 */
export const toDatetimeLocal = (date: Date): string => {
  const tzOffset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - tzOffset).toISOString().slice(0, 16);
};

/**
 * Converts a datetime-local input value to an ISO 8601 string.
 * Returns empty string for invalid or empty inputs.
 *
 * @param value - String value from datetime-local input
 * @returns ISO 8601 date string or empty string if invalid
 */
export const toIsoString = (value: string): string => {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
};

/**
 * Parses a datetime-local input value to a Date object.
 * Returns null for invalid or empty inputs.
 *
 * @param value - String value from datetime-local input
 * @returns Date object or null if invalid
 */
export const parseLocalDateTime = (value: string): Date | null => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};
