/**
 * Sanitizes an unknown value into a string array.
 * Filters out non-string values and empty strings.
 *
 * @param value - Unknown value to sanitize
 * @returns Array of non-empty strings
 */
export const sanitizeStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter((item) => item.length > 0);
};

/**
 * Alias for sanitizeStringArray - for semantic clarity when sanitizing user IDs
 */
export const sanitizeUserIds = sanitizeStringArray;

/**
 * Alias for sanitizeStringArray - for semantic clarity when sanitizing spot IDs
 */
export const sanitizeSpotIds = sanitizeStringArray;
