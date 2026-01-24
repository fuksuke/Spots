import { z } from "zod";

/**
 * Common Zod schemas for reuse across controllers
 */

/**
 * Limit schema with configurable max value
 * Default max is 50
 */
export const limitSchema = (max = 50) =>
  z.coerce.number().int().min(1).max(max).optional();

/**
 * Cursor-based pagination schema
 */
export const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).optional(),
  cursor: z.string().min(1).optional(),
});

/**
 * Pagination schema with configurable max limit
 */
export const paginationSchemaWithMax = (maxLimit: number) =>
  z.object({
    limit: z.coerce.number().int().min(1).max(maxLimit).optional(),
    cursor: z.string().min(1).optional(),
  });

/**
 * Common status filter for admin queries
 */
export const statusFilterSchema = <T extends string>(values: readonly [T, ...T[]]) =>
  z.enum(values).optional();

/**
 * Common ID parameter schema
 */
export const idParamSchema = z.object({
  id: z.string().min(1),
});
