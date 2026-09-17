/* eslint-disable perfectionist/sort-imports */

'use client';

import 'dayjs/locale/en';
import 'dayjs/locale/vi';
import 'dayjs/locale/fr';
import 'dayjs/locale/th';
import 'dayjs/locale/zh-cn';
import 'dayjs/locale/ar-sa';

import dayjs from 'dayjs';
import buddhistEra from 'dayjs/plugin/buddhistEra';

import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { LocalizationProvider as Provider } from '@mui/x-date-pickers/LocalizationProvider';

import { useTranslate } from './use-locales';

// ----------------------------------------------------------------------

dayjs.extend(buddhistEra);

// ระบบนี้ใช้ในโรงพยาบาลไทยล้วน ตัวเลือกภาษาอื่น (en/vi/fr/zh-cn/ar) เป็นของเทมเพลตเดิมที่ไม่ได้ใช้
// แปลข้อความจริงในแอปนี้ (ข้อความเป็นภาษาไทยแบบ hardcode ทั้งหมดอยู่แล้ว) จึงบังคับ locale ปฏิทิน +
// รูปแบบวันที่ของ DatePicker/DateCalendar ทั้งแอปให้เป็นไทย (วัน/เดือน/ปี พ.ศ.) เสมอ ไม่ผูกกับตัวเลือก
// ภาษาที่มุมขวาบน
// หมายเหตุ: ช่อง keyboardDate/keyboardDateTime ใช้ YYYY (ไม่ใช่ BBBB) โดยตั้งใจ — ช่องกรอกวันที่ของ
// MUI ใช้ระบบแก้ไขทีละ section (คลิกแล้วพิมพ์ทับ) ที่รู้จักแค่ token มาตรฐานของ dayjs เท่านั้น ถ้าใส่
// BBBB (token จาก plugin buddhistEra) จะขึ้นเป็นตัวอักษร "BBBB" ตรงๆ ไม่แปลงเป็นเลขปี — ส่วนอื่นที่เป็น
// label แสดงผลอย่างเดียว (ปฏิทิน, ปุ่มเลือกปี) ใช้ BBBB ได้ปกติเพราะแค่เรียก .format() ธรรมดา
const DATE_FORMATS = {
  year: 'BBBB',
  // ทั้งสองคีย์นี้ของ default (AdapterDayjs) เป็น shorthand token ของ dayjs ('ll') ที่ resolve ปีจาก
  // locale file ตรงๆ (ยังเป็น YYYY เสมอ ไม่ว่า locale จะเป็นอะไร) จึงต้องเขียนทับด้วย format
  // ตรงๆ ที่มี BBBB เองแทน ไม่งั้น aria-label/label ต่างๆ ของปฏิทิน (เช่น "Choose date, selected
  // date is...") จะยังโชว์ปี ค.ศ. อยู่
  fullDate: 'D MMMM BBBB',
  keyboardDate: 'DD/MM/YYYY',
  keyboardDateTime: 'DD/MM/YYYY HH:mm',
  normalDate: 'D MMMM',
  normalDateWithWeekday: 'ddd D MMM',
  shortDate: 'D MMM',
};

export function LocalizationProvider({ children }) {
  // ยังเรียก useTranslate() ไว้เผื่อโค้ดอื่นใน context นี้ยังอ้างอิงอยู่ แต่ไม่เอา currentLang.adapterLocale
  // มาตั้ง global dayjs locale อีกต่อไป (ดูคอมเมนต์ด้านบน — บังคับ 'th' ทั้งแอปแทน)
  useTranslate();

  return (
    <Provider dateAdapter={AdapterDayjs} adapterLocale="th" dateFormats={DATE_FORMATS}>
      {children}
    </Provider>
  );
}
