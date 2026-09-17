import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import { useTheme } from '@mui/material/styles';

import { varAlpha, hideScrollY } from 'src/theme/styles';

import { Logo } from 'src/components/logo';
import { Scrollbar } from 'src/components/scrollbar';
import { NavSectionMini, NavSectionVertical } from 'src/components/nav-section';

import { splitNavDataByHqSection } from './split-nav-data';
import { NavToggleButton } from '../components/nav-toggle-button';
import { HospitalWorkspaceSwitcher } from '../components/hospital-workspace-switcher';

// ----------------------------------------------------------------------

export function NavVertical({ sx, data, slots, isNavMini, layoutQuery, onToggleNav, ...other }) {
  const theme = useTheme();

  // เมนู "ศูนย์บริหารเครือข่าย" ไม่ผูกกับโรงพยาบาลที่เลือก (superadmin มองข้าม tenant ได้) จึงแยก
  // ไปแสดงเหนือตัวเลือกโรงพยาบาล ส่วนเมนูที่เหลือทั้งหมด (ผูกกับโรงพยาบาลที่เลือกอยู่) อยู่ใต้ตัวเลือก
  const { hqData, restData } = splitNavDataByHqSection(data);

  const renderNavVertical = (
    <>
      {slots?.topArea ?? (
        <>
          <Box sx={{ pl: 3.5, pr: 2, pt: 2.5, pb: hqData.length > 0 ? 1.5 : 2 }}>
            <Logo width={160} height={50} sx={{ width: 160, height: 50, mb: 2 }} />
            {hqData.length > 0 && (
              <>
                <NavSectionVertical data={hqData} {...other} />
                <Divider sx={{ my: 1.5, borderStyle: 'dashed' }} />
              </>
            )}
          </Box>
          <Box sx={{ px: 2, pb: 2 }}>
            <HospitalWorkspaceSwitcher />
          </Box>
        </>
      )}

      <Scrollbar fillContent>
        <NavSectionVertical data={restData} sx={{ px: 2, flex: '1 1 auto' }} {...other} />

        {slots?.bottomArea}
      </Scrollbar>
    </>
  );

  const renderNavMini = (
    <>
      {slots?.topArea ?? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 2.5 }}>
          <Logo />
        </Box>
      )}

      <NavSectionMini
        data={data}
        sx={{ pb: 2, px: 0.5, ...hideScrollY, flex: '1 1 auto', overflowY: 'auto' }}
        {...other}
      />

      {slots?.bottomArea}
    </>
  );

  return (
    <Box
      sx={{
        top: 0,
        left: 0,
        height: 1,
        display: 'none',
        position: 'fixed',
        flexDirection: 'column',
        bgcolor: 'var(--layout-nav-bg)',
        zIndex: 'var(--layout-nav-zIndex)',
        width: isNavMini ? 'var(--layout-nav-mini-width)' : 'var(--layout-nav-vertical-width)',
        borderRight: `1px solid var(--layout-nav-border-color, ${varAlpha(theme.vars.palette.grey['500Channel'], 0.12)})`,
        transition: theme.transitions.create(['width'], {
          easing: 'var(--layout-transition-easing)',
          duration: 'var(--layout-transition-duration)',
        }),
        [theme.breakpoints.up(layoutQuery)]: {
          display: 'flex',
        },
        ...sx,
      }}
    >
      <NavToggleButton
        isNavMini={isNavMini}
        onClick={onToggleNav}
        sx={{
          display: 'none',
          [theme.breakpoints.up(layoutQuery)]: {
            display: 'inline-flex',
          },
        }}
      />
      {isNavMini ? renderNavMini : renderNavVertical}
    </Box>
  );
}
