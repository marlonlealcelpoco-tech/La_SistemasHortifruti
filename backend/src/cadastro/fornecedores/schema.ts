import { z } from "zod";

export const supplierIdSchema = z.object({ id: z.coerce.number().int().positive() });

export const supplierSearchSchema = z.object({
  search: z.string().trim().min(1).max(180).optional()
});

export const supplierSchema = z.object({
  name: z.string().trim().min(2).max(180),
  document: z.string().trim().max(30).nullable().optional(),
  email: z.string().email().max(180).nullable().optional(),
  phone: z.string().trim().max(40).nullable().optional()
});

export const supplierStatusSchema = z.object({ active: z.boolean() });
