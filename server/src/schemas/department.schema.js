import { z } from 'zod';

const LEVEL_TYPES = ['BUILDING', 'FLOOR', 'WARD'];

export const listDepartmentsSchema = z.object({
  query: z.object({
    hospitalId: z.coerce.number().int().positive().optional(),
  }),
});

export const createDepartmentSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(150),
    levelType: z.enum(LEVEL_TYPES),
    parentId: z.coerce.number().int().positive().optional(),
    hospitalId: z.coerce.number().int().positive().optional(),
  }),
});

export const updateDepartmentSchema = z.object({
  params: z.object({ id: z.coerce.number().int().positive() }),
  body: z.object({
    name: z.string().min(1).max(150).optional(),
    // ใช้ parentId ตอน drag-and-drop เปลี่ยนสายบังคับบัญชา — ส่ง null เพื่อย้ายขึ้นเป็น root (BUILDING)
    parentId: z.coerce.number().int().positive().nullable().optional(),
    // ใช้ sortOrder ตอนลากจัดลำดับใน parent เดียวกัน (index ตำแหน่งใหม่ เริ่มที่ 0)
    sortOrder: z.coerce.number().int().min(0).optional(),
  }),
});

export const departmentParamsSchema = z.object({
  params: z.object({ id: z.coerce.number().int().positive() }),
});
