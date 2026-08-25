import { z } from "zod";

export const productIdSchema = z.object({ id: z.coerce.number().int().positive() });
export const productSearchSchema = z.object({ search: z.string().trim().min(1).max(180).optional() });

export const productSchema = z.object({
  code: z.string().trim().min(1).max(60),
  name: z.string().trim().min(2).max(180),
  description: z.string().trim().max(10_000).nullable().optional(),
  unit: z.string().trim().min(1).max(20).default("UN"),
  cost: z.coerce.number().nonnegative(),
  salePrice: z.coerce.number().nonnegative(),
  profitMarginPct: z.coerce.number().min(0).max(999.99).default(0),
  ncm: z.string().regex(/^\d{8}$/).nullable().optional(),
  cest: z.string().regex(/^\d{7}$/).nullable().optional(),
  cfop: z.string().regex(/^\d{4}$/).nullable().optional(),
  taxCodeType: z.enum(["CST", "CSOSN"]).nullable().optional(),
  taxCode: z.string().regex(/^\d{2,4}$/).nullable().optional(),
  origin: z.coerce.number().int().min(0).max(8).nullable().optional(),
  gtin: z.string().regex(/^\d{8,14}$/).nullable().optional(),
  gtinTrib: z.string().regex(/^\d{8,14}$/).nullable().optional(),
  taxUnit: z.string().trim().min(1).max(20).nullable().optional(),
  icmsRate: z.coerce.number().min(0).max(100).default(0),
  pisCst: z.string().regex(/^\d{2}$/).nullable().optional(),
  pisRate: z.coerce.number().min(0).max(100).default(0),
  cofinsCst: z.string().regex(/^\d{2}$/).nullable().optional(),
  cofinsRate: z.coerce.number().min(0).max(100).default(0)
}).superRefine((data, ctx) => {
  if (data.taxCodeType && !data.taxCode) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["taxCode"], message: "Código tributário é obrigatório quando o tipo CST/CSOSN é informado." });
  }
});

export const productStatusSchema = z.object({ active: z.boolean() });
export const productMinimumSchema = z.object({ minimumQuantity: z.coerce.number().nonnegative() });

export type ProductForm = z.infer<typeof productSchema>;
