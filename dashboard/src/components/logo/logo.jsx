'use client';

import { forwardRef } from 'react';

import Box from '@mui/material/Box';

import { RouterLink } from 'src/routes/components';

import { CONFIG } from 'src/config-global';

import { logoClasses } from './classes';

// ----------------------------------------------------------------------

// โลโก้ WelGroup — ไฟล์ต้นฉบับเป็นภาพแนวนอน (อัตราส่วนประมาณ 3:1) ไม่มีไอคอนสี่เหลี่ยมจัตุรัสแยกต่างหาก
// จึงใช้ภาพเดียวกันทั้ง isSingle และ full พร้อม object-fit: contain กันภาพบิดเบี้ยว
export const Logo = forwardRef(
  (
    { width, href = '/', height, isSingle = true, disableLink = false, className, sx, ...other },
    ref
  ) => {
    const logoImage = (
      <Box
        component="img"
        alt="WelGroup logo"
        src={`${CONFIG.assetsDir}/logo/welgroup-logo.jpg`}
        sx={{ width: 1, height: 1, objectFit: 'contain' }}
      />
    );

    const baseSize = {
      width: width ?? (isSingle ? 46 : 140),
      height: height ?? (isSingle ? 46 : 44),
    };

    return (
      <Box
        ref={ref}
        component={RouterLink}
        href={href}
        className={logoClasses.root.concat(className ? ` ${className}` : '')}
        aria-label="Logo"
        sx={{
          ...baseSize,
          flexShrink: 0,
          display: 'inline-flex',
          verticalAlign: 'middle',
          ...(disableLink && { pointerEvents: 'none' }),
          ...sx,
        }}
        {...other}
      >
        {logoImage}
      </Box>
    );
  }
);
