'use client';

import { m } from 'framer-motion';

import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';

import { usePermission } from 'src/hooks/use-has-permission';

import { ForbiddenIllustration } from 'src/assets/illustrations';

import { LoadingScreen } from 'src/components/loading-screen';
import { varBounce, MotionContainer } from 'src/components/animate';

// ----------------------------------------------------------------------

// ครอบหน้า dashboard ที่ต้องมีสิทธิ์เมนู web.<module>.view — ไม่มีสิทธิ์แสดงหน้า "ไม่มีสิทธิ์"
// (backend เป็นตัวกันจริงอีกชั้น — ตัวนี้กัน UX งงว่าเปิดหน้าได้แต่ทุก request แดง)
export function PermissionGuard({ perm, children, sx }) {
  const { can, ready } = usePermission();

  if (!ready) {
    return <LoadingScreen />;
  }

  if (!can(perm)) {
    return (
      <Container component={MotionContainer} sx={{ textAlign: 'center', py: 10, ...sx }}>
        <m.div variants={varBounce().in}>
          <Typography variant="h3" sx={{ mb: 2 }}>
            ไม่มีสิทธิ์เข้าถึงหน้านี้
          </Typography>
        </m.div>

        <m.div variants={varBounce().in}>
          <Typography sx={{ color: 'text.secondary' }}>
            กรุณาติดต่อผู้ดูแลระบบให้เปิดสิทธิ์เมนูนี้ให้
          </Typography>
        </m.div>

        <m.div variants={varBounce().in}>
          <ForbiddenIllustration sx={{ my: { xs: 5, sm: 10 } }} />
        </m.div>
      </Container>
    );
  }

  return children;
}
