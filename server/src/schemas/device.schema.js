import { z } from 'zod';

const DEVICE_TYPES = ['WEIGHT_GATE', 'FOLDING_TABLE', 'WARD_KIOSK', 'HANDHELD', 'RFID_CHECKPOINT'];
const SCAN_PROFILES = ['VERY_FAST', 'FAST', 'NORMAL', 'THOROUGH'];

// จุดสแกนหน้างานที่ตั้ง "เครื่องเริ่มต้น" ได้ (ต้องตรงกับ dashboard/src/sections/devices/device-constants.js)
const SCAN_POINTS = ['WASH_RECEIVE', 'STOCK_SCAN', 'FABRIC_REGISTER', 'FABRIC_REGISTER_HANDHELD'];

export const listDevicesSchema = z.object({
  query: z.object({
    deviceType: z.enum(DEVICE_TYPES).optional(),
    hospitalId: z.coerce.number().int().positive().optional(),
  }),
});

export const createDeviceSchema = z.object({
  body: z.object({
    deviceType: z.enum(DEVICE_TYPES),
    caretakerName: z.string().max(150).optional(),
    caretakerPhone: z.string().max(30).optional(),
    rssiThresholdDbm: z.coerce.number().int().optional(),
    targetBundleSize: z.coerce.number().int().positive().optional(),
    ipAddress: z.string().max(45).optional(),
    port: z.coerce.number().int().min(1).max(65535).optional(),
    scanProfile: z.enum(SCAN_PROFILES).optional(),
    scanPowerDbm: z.coerce.number().int().min(0).max(18).optional(),
    defaultScanPoints: z.array(z.enum(SCAN_POINTS)).nullable().optional(),
    hospitalId: z.coerce.number().int().positive().optional(),
  }),
});

// PATCH /devices/:id — operator ที่ได้รับสิทธิ์แก้ได้แค่ caretakerName/Phone, admin แก้ config ได้ทั้งหมด
// (การบังคับสิทธิ์รายฟิลด์อยู่ใน controller) ฟิลด์ที่ส่ง null มา = สั่งล้างค่า
export const updateDeviceSchema = z.object({
  params: z.object({ id: z.coerce.number().int().positive() }),
  body: z.object({
    deviceType: z.enum(DEVICE_TYPES).optional(),
    caretakerName: z.string().max(150).nullable().optional(),
    caretakerPhone: z.string().max(30).nullable().optional(),
    rssiThresholdDbm: z.coerce.number().int().optional(),
    targetBundleSize: z.coerce.number().int().positive().nullable().optional(),
    ipAddress: z.string().max(45).nullable().optional(),
    port: z.coerce.number().int().min(1).max(65535).nullable().optional(),
    scanProfile: z.enum(SCAN_PROFILES).optional(),
    scanPowerDbm: z.coerce.number().int().min(0).max(18).nullable().optional(),
    defaultScanPoints: z.array(z.enum(SCAN_POINTS)).nullable().optional(),
  }),
});

export const heartbeatParamsSchema = z.object({
  params: z.object({ id: z.coerce.number().int().positive() }),
});
