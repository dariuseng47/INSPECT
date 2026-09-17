import Avatar from '@mui/material/Avatar';

import { Iconify } from 'src/components/iconify';

// ----------------------------------------------------------------------

// avatar ไอคอนวงกลมสี — ใช้เป็นหัวข้อของทุกการ์ดในหน้า "ประวัติ & วิเคราะห์การเติมผ้า"
// เพื่อให้แต่ละบล็อกดูออกง่ายด้วยสี/ไอคอนโดยไม่ต้องอ่านหัวข้อ
export function SectionAvatar({ icon, color = 'primary' }) {
  return (
    <Avatar sx={{ bgcolor: `${color}.lighter`, color: `${color}.darker` }}>
      <Iconify icon={icon} width={22} />
    </Avatar>
  );
}
