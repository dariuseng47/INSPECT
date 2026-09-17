import 'dayjs/locale/th';
import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration';
import buddhistEra from 'dayjs/plugin/buddhistEra';
import relativeTime from 'dayjs/plugin/relativeTime';

// ----------------------------------------------------------------------

dayjs.extend(duration);
dayjs.extend(relativeTime);
dayjs.extend(buddhistEra);

// ระบบนี้ใช้ในโรงพยาบาลไทยล้วน วันที่ที่แสดงผลทั้งหมดจึงใช้ปี พ.ศ. (token BBBB จาก plugin
// buddhistEra) และชื่อเดือนไทย — ผูก .locale('th') ไว้ที่ตัวแปร dayjs instance ในแต่ละฟังก์ชัน
// ด้านล่างเท่านั้น (ไม่เรียก dayjs.locale('th') แบบ global) เพื่อไม่ให้กระทบ default locale
// ของ dayjs ทั้งโปรเซส เผื่อโค้ดที่อื่นเรียก dayjs() ตรงๆ โดยไม่ผ่านฟังก์ชันพวกนี้
const th = (date) => dayjs(date).locale('th');

/**
 * Docs: https://day.js.org/docs/en/display/format
 */
export const formatStr = {
  dateTime: 'D MMM BBBB H:mm น.', // 17 เม.ย. 2565 12:00 น.
  date: 'D MMM BBBB', // 17 เม.ย. 2565
  time: 'H:mm น.', // 12:00 น.
  split: {
    dateTime: 'DD/MM/BBBB H:mm', // 17/04/2565 12:00
    date: 'DD/MM/BBBB', // 17/04/2565
  },
  paramCase: {
    dateTime: 'DD-MM-BBBB H:mm', // 17-04-2565 12:00
    date: 'DD-MM-BBBB', // 17-04-2565
  },
};

export function today(format) {
  return dayjs(new Date()).startOf('day').format(format);
}

// ----------------------------------------------------------------------

/** output: 17 Apr 2022 12:00 am
 */
export function fDateTime(date, format) {
  if (!date) {
    return null;
  }

  const isValid = dayjs(date).isValid();

  return isValid ? th(date).format(format ?? formatStr.dateTime) : 'Invalid time value';
}

// ----------------------------------------------------------------------

/** output: 17 Apr 2022
 */
export function fDate(date, format) {
  if (!date) {
    return null;
  }

  const isValid = dayjs(date).isValid();

  return isValid ? th(date).format(format ?? formatStr.date) : 'Invalid time value';
}

// ----------------------------------------------------------------------

/** output: 12:00 am
 */
export function fTime(date, format) {
  if (!date) {
    return null;
  }

  const isValid = dayjs(date).isValid();

  return isValid ? th(date).format(format ?? formatStr.time) : 'Invalid time value';
}

// ----------------------------------------------------------------------

/** output: 1713250100
 */
export function fTimestamp(date) {
  if (!date) {
    return null;
  }

  const isValid = dayjs(date).isValid();

  return isValid ? dayjs(date).valueOf() : 'Invalid time value';
}

// ----------------------------------------------------------------------

/** output: a few seconds, 2 years
 */
export function fToNow(date) {
  if (!date) {
    return null;
  }

  const isValid = dayjs(date).isValid();

  return isValid ? dayjs(date).toNow(true) : 'Invalid time value';
}

// ----------------------------------------------------------------------

/** output: boolean
 */
export function fIsBetween(inputDate, startDate, endDate) {
  if (!inputDate || !startDate || !endDate) {
    return false;
  }

  const formattedInputDate = fTimestamp(inputDate);
  const formattedStartDate = fTimestamp(startDate);
  const formattedEndDate = fTimestamp(endDate);

  if (formattedInputDate && formattedStartDate && formattedEndDate) {
    return formattedInputDate >= formattedStartDate && formattedInputDate <= formattedEndDate;
  }

  return false;
}

// ----------------------------------------------------------------------

/** output: boolean
 */
export function fIsAfter(startDate, endDate) {
  return dayjs(startDate).isAfter(endDate);
}

// ----------------------------------------------------------------------

/** output: boolean
 */
export function fIsSame(startDate, endDate, units) {
  if (!startDate || !endDate) {
    return false;
  }

  const isValid = dayjs(startDate).isValid() && dayjs(endDate).isValid();

  if (!isValid) {
    return 'Invalid time value';
  }

  return dayjs(startDate).isSame(endDate, units ?? 'year');
}

// ----------------------------------------------------------------------

/** output:
 * Same day: 26 Apr 2024
 * Same month: 25 - 26 Apr 2024
 * Same month: 25 - 26 Apr 2024
 * Same year: 25 Apr - 26 May 2024
 */
export function fDateRangeShortLabel(startDate, endDate, initial) {
  const isValid = dayjs(startDate).isValid() && dayjs(endDate).isValid();

  const isAfter = fIsAfter(startDate, endDate);

  if (!isValid || isAfter) {
    return 'Invalid time value';
  }

  let label = `${fDate(startDate)} - ${fDate(endDate)}`;

  if (initial) {
    return label;
  }

  const isSameYear = fIsSame(startDate, endDate, 'year');
  const isSameMonth = fIsSame(startDate, endDate, 'month');
  const isSameDay = fIsSame(startDate, endDate, 'day');

  if (isSameYear && !isSameMonth) {
    label = `${fDate(startDate, 'DD MMM')} - ${fDate(endDate)}`;
  } else if (isSameYear && isSameMonth && !isSameDay) {
    label = `${fDate(startDate, 'DD')} - ${fDate(endDate)}`;
  } else if (isSameYear && isSameMonth && isSameDay) {
    label = `${fDate(endDate)}`;
  }

  return label;
}

/** output: '2024-05-28T05:55:31+00:00'
 */
export function fAdd({
  years = 0,
  months = 0,
  days = 0,
  hours = 0,
  minutes = 0,
  seconds = 0,
  milliseconds = 0,
}) {
  const result = dayjs()
    .add(
      dayjs.duration({
        years,
        months,
        days,
        hours,
        minutes,
        seconds,
        milliseconds,
      })
    )
    .format();

  return result;
}

/** output: '2024-05-28T05:55:31+00:00'
 */
export function fSub({
  years = 0,
  months = 0,
  days = 0,
  hours = 0,
  minutes = 0,
  seconds = 0,
  milliseconds = 0,
}) {
  const result = dayjs()
    .subtract(
      dayjs.duration({
        years,
        months,
        days,
        hours,
        minutes,
        seconds,
        milliseconds,
      })
    )
    .format();

  return result;
}
