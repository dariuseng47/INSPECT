'use client';

import Card from '@mui/material/Card';
import Typography from '@mui/material/Typography';

import { DashboardContent } from 'src/layouts/dashboard';

import { EmptyContent } from 'src/components/empty-content';

// ----------------------------------------------------------------------

// ใช้เป็นหน้า placeholder สำหรับเมนูที่ยัง implement ไม่เสร็จ เพื่อให้ IA ทั้งระบบ navigate ได้ครบตาม PROMPT_MASTER.md
// ไม่ใช้ 404 เพราะเมนูเหล่านี้เป็นฟีเจอร์จริงที่วางแผนไว้ ไม่ใช่ path ที่ไม่มีอยู่จริง
export function LmsComingSoonView({ title, description = 'ฟีเจอร์นี้อยู่ระหว่างพัฒนา' }) {
  return (
    <DashboardContent maxWidth="xl">
      <Typography variant="h4" sx={{ mb: 5 }}>
        {title}
      </Typography>

      <Card>
        <EmptyContent title="เร็วๆ นี้" description={description} sx={{ py: 12 }} />
      </Card>
    </DashboardContent>
  );
}
