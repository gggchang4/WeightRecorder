import { z } from 'zod';
import { isValidDate, localDate } from '../shared/domain.ts';

export const dateSchema = z.string().refine(isValidDate, '请输入有效日期，格式为 YYYY-MM-DD')
  .refine(value => value >= '1900-01-01' && value <= localDate(), '记录日期应在 1900 年至今天之间');
export const entrySchema = z.object({
  date: dateSchema,
  weightKg: z.number().finite().min(1, '体重不能小于 1 kg').max(500, '体重不能超过 500 kg'),
  note: z.string().trim().max(500, '备注最多 500 字').default(''),
  mood: z.enum(['good', 'neutral', 'tired']).default('neutral'),
});
export const settingsSchema = z.object({
  displayName: z.string().trim().min(1).max(30),
  heightCm: z.number().finite().min(50).max(260).nullable(),
  targetWeightKg: z.number().finite().min(1).max(500).nullable(),
  unit: z.enum(['kg', 'lb']),
  theme: z.enum(['light', 'dark', 'system']),
});
export const backupSchema = z.object({
  format: z.literal('qingji-backup'),
  version: z.literal(1),
  exportedAt: z.string(),
  settings: settingsSchema,
  entries: z.array(entrySchema).max(20_000, '单次最多导入 20,000 条记录'),
});

export class AppError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}
