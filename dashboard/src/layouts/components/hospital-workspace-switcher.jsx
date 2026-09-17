'use client';

import { useMemo } from 'react';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Avatar from '@mui/material/Avatar';
import Skeleton from '@mui/material/Skeleton';
import MenuList from '@mui/material/MenuList';
import MenuItem from '@mui/material/MenuItem';
import ButtonBase from '@mui/material/ButtonBase';
import Typography from '@mui/material/Typography';

import { useEffectiveHospital } from 'src/hooks/use-effective-hospital';

import { Iconify } from 'src/components/iconify';
import { Scrollbar } from 'src/components/scrollbar';
import { usePopover, CustomPopover } from 'src/components/custom-popover';

import { useAuthContext } from 'src/auth/hooks';

// ----------------------------------------------------------------------

function HospitalAvatar({ sx }) {
  return (
    <Avatar sx={{ width: 36, height: 36, bgcolor: 'primary.lighter', color: 'primary.dark', ...sx }}>
      <Iconify icon="solar:hospital-bold-duotone" width={20} />
    </Avatar>
  );
}

// สลับ "โรงพยาบาลที่กำลังดูอยู่" — แทนที่ปุ่ม workspace switcher เดิมของ template ("Team 1")
// ด้วยโรงพยาบาลจริงของระบบ อยู่บนสุดของ sidebar เสมอ ไม่ว่าจะเลื่อนเมนูหรือเปลี่ยนหน้าไปไหน
// - superadmin: กดเปลี่ยนโรงพยาบาลได้ (ค่าที่เลือกจำไว้ระดับ global ผ่าน useEffectiveHospital)
// - admin/operator: แสดงชื่อโรงพยาบาลของตัวเองแบบ read-only (มี tenant เดียวอยู่แล้ว)
export function HospitalWorkspaceSwitcher({ sx, ...other }) {
  const { user } = useAuthContext();
  const { hospitalId, isSuperadmin, hospitals, hospitalsLoading, setSelectedHospitalId } =
    useEffectiveHospital();

  const popover = usePopover();

  const currentHospital = useMemo(
    () => hospitals.find((hospital) => hospital.id === hospitalId),
    [hospitals, hospitalId]
  );

  const displayName = isSuperadmin ? currentHospital?.name : user?.hospital_name;
  const displaySubtitle = isSuperadmin ? currentHospital?.organization_name : 'โรงพยาบาลของคุณ';

  const handleSelect = (id) => {
    setSelectedHospitalId(id);
    popover.onClose();
  };

  if (isSuperadmin && hospitalsLoading) {
    return (
      <Stack direction="row" spacing={1.5} alignItems="center" sx={{ px: 1.5, py: 1.25, ...sx }}>
        <Skeleton variant="circular" width={36} height={36} />
        <Stack spacing={0.5} sx={{ flexGrow: 1 }}>
          <Skeleton variant="text" sx={{ width: '70%' }} />
          <Skeleton variant="text" sx={{ width: '45%' }} />
        </Stack>
      </Stack>
    );
  }

  if (!displayName) return null;

  return (
    <>
      <ButtonBase
        disabled={!isSuperadmin}
        disableRipple={!isSuperadmin}
        onClick={popover.onOpen}
        sx={{
          width: 1,
          py: 1.25,
          px: 1.5,
          gap: 1.25,
          borderRadius: 1.5,
          justifyContent: 'flex-start',
          border: (theme) => `1px solid ${theme.vars.palette.divider}`,
          transition: (theme) => theme.transitions.create(['background-color']),
          ...(isSuperadmin && { '&:hover': { bgcolor: 'action.hover' } }),
          ...sx,
        }}
        {...other}
      >
        <HospitalAvatar />

        <Stack sx={{ minWidth: 0, flexGrow: 1, textAlign: 'left' }}>
          <Typography variant="subtitle2" noWrap>
            {displayName}
          </Typography>
          <Typography variant="caption" noWrap sx={{ color: 'text.secondary' }}>
            {displaySubtitle}
          </Typography>
        </Stack>

        {isSuperadmin && (
          <Iconify
            width={16}
            icon="carbon:chevron-sort"
            sx={{ color: 'text.disabled', flexShrink: 0 }}
          />
        )}
      </ButtonBase>

      {isSuperadmin && (
        <CustomPopover
          open={popover.open}
          anchorEl={popover.anchorEl}
          onClose={popover.onClose}
          slotProps={{ arrow: { placement: 'top-left' } }}
        >
          <Box sx={{ px: 2, pt: 1.5, pb: 1 }}>
            <Typography variant="overline" sx={{ color: 'text.disabled' }}>
              เลือกโรงพยาบาล
            </Typography>
          </Box>

          <Scrollbar sx={{ width: 340, maxHeight: 360 }}>
            <MenuList sx={{ width: 1 }}>
              {hospitals.map((hospital) => (
                <MenuItem
                  key={hospital.id}
                  selected={hospital.id === hospitalId}
                  onClick={() => handleSelect(hospital.id)}
                  sx={{ height: 56, gap: 1.25 }}
                >
                  <HospitalAvatar sx={{ width: 32, height: 32 }} />

                  <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                    <Typography variant="body2" noWrap sx={{ fontWeight: 600 }}>
                      {hospital.name}
                    </Typography>
                    <Typography
                      variant="caption"
                      noWrap
                      sx={{ color: 'text.secondary', display: 'block' }}
                    >
                      {hospital.organization_name}
                    </Typography>
                  </Box>

                  {hospital.id === hospitalId && (
                    <Iconify
                      icon="eva:checkmark-fill"
                      width={18}
                      sx={{ color: 'primary.main', flexShrink: 0 }}
                    />
                  )}
                </MenuItem>
              ))}
            </MenuList>
          </Scrollbar>
        </CustomPopover>
      )}
    </>
  );
}
