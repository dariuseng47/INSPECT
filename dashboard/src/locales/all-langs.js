'use client';

// core (MUI)
import { thTH as thTHCore } from '@mui/material/locale';
// date pickers (MUI ยังไม่มี locale ไทยของแพ็กเกจนี้ ใช้ enUS แทน)
import { enUS as enUSDate } from '@mui/x-date-pickers/locales';
// data grid (MUI ยังไม่มี locale ไทยของแพ็กเกจนี้ ใช้ enUS แทน)
import { enUS as enUSDataGrid } from '@mui/x-data-grid/locales';

// ----------------------------------------------------------------------

// ระบบนี้ใช้ในโรงพยาบาลไทยล้วน จึงเหลือตัวเลือกภาษาเดียวคือไทย (ดูคอมเมนต์ใน
// src/locales/localization-provider.jsx ที่บังคับปฏิทิน/รูปแบบวันที่เป็นไทยอยู่แล้วโดยไม่ผูกกับที่นี่)
export const allLangs = [
  {
    value: 'th',
    label: 'ไทย',
    countryCode: 'TH',
    adapterLocale: 'th',
    numberFormat: { code: 'th-TH', currency: 'THB' },
    systemValue: {
      components: { ...thTHCore.components, ...enUSDate.components, ...enUSDataGrid.components },
    },
  },
];

/**
 * Country code:
 * https://flagcdn.com/en/codes.json
 *
 * Number format code:
 * https://gist.github.com/raushankrjha/d1c7e35cf87e69aa8b4208a8171a8416
 */
