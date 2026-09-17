import { useEffect } from 'react';

import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import Drawer, { drawerClasses } from '@mui/material/Drawer';

import { usePathname } from 'src/routes/hooks';

import { Logo } from 'src/components/logo';
import { Scrollbar } from 'src/components/scrollbar';
import { NavSectionVertical } from 'src/components/nav-section';

import { splitNavDataByHqSection } from './split-nav-data';
import { HospitalWorkspaceSwitcher } from '../components/hospital-workspace-switcher';

// ----------------------------------------------------------------------

export function NavMobile({ data, open, onClose, slots, sx, ...other }) {
  const pathname = usePathname();

  useEffect(() => {
    if (open) {
      onClose();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // เมนู "ศูนย์บริหารเครือข่าย" ไม่ผูกกับโรงพยาบาลที่เลือก จึงแยกไปแสดงเหนือตัวเลือกโรงพยาบาล
  // เหมือนกับ nav-vertical.jsx (ดูคอมเมนต์เต็มที่นั่น)
  const { hqData, restData } = splitNavDataByHqSection(data);

  return (
    <Drawer
      open={open}
      onClose={onClose}
      sx={{
        [`& .${drawerClasses.paper}`]: {
          overflow: 'unset',
          bgcolor: 'var(--layout-nav-bg)',
          width: 'var(--layout-nav-mobile-width)',
          ...sx,
        },
      }}
    >
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
      </Scrollbar>

      {slots?.bottomArea}
    </Drawer>
  );
}
