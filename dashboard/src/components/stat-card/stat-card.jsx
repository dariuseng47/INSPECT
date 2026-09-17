import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import CardContent from '@mui/material/CardContent';

import { varAlpha } from 'src/theme/styles';

import { Iconify } from 'src/components/iconify';

// ----------------------------------------------------------------------

// สต๊อกการ์ดสรุปตัวเลขแบบมาตรฐาน ใช้ร่วมกันทุกหน้า dashboard (ภาพรวมเดี่ยว/ภาพรวมข้ามโรงพยาบาล)
// เพื่อให้ภาษาภาพ (visual language) สม่ำเสมอทั้งระบบ
export function StatCard({ icon, title, value, color = 'primary', sx }) {
  return (
    <Card
      sx={{
        position: 'relative',
        overflow: 'hidden',
        transition: (theme) => theme.transitions.create(['box-shadow', 'transform']),
        '&:hover': { boxShadow: (theme) => theme.customShadows?.z20, transform: 'translateY(-2px)' },
        ...sx,
      }}
    >
      <Iconify
        icon={icon}
        width={100}
        sx={{
          position: 'absolute',
          top: -20,
          right: -20,
          opacity: 0.12,
          color: (theme) => theme.vars.palette[color].main,
        }}
      />

      <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <Stack
          sx={{
            width: 48,
            height: 48,
            flexShrink: 0,
            borderRadius: '50%',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: (theme) => varAlpha(theme.vars.palette[color].mainChannel, 0.12),
            color: (theme) => theme.vars.palette[color].dark,
          }}
        >
          <Iconify icon={icon} width={24} />
        </Stack>
        <Stack sx={{ minWidth: 0 }}>
          <Typography variant="h4">{value}</Typography>
          <Typography variant="body2" noWrap sx={{ color: 'text.secondary' }}>
            {title}
          </Typography>
        </Stack>
      </CardContent>
    </Card>
  );
}
