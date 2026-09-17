'use client';

import { useState, useEffect } from 'react';
import Autoplay from 'embla-carousel-autoplay';

import Box from '@mui/material/Box';
import Dialog from '@mui/material/Dialog';
import IconButton from '@mui/material/IconButton';

import { CONFIG } from 'src/config-global';
import { useGetLoginPopupImagesForMe } from 'src/actions/loginPopupImages';

import { JUST_LOGGED_IN_KEY } from 'src/auth/context/jwt/constant';

import { Iconify } from '../iconify';
import { Carousel, useCarousel, CarouselDotButtons } from '../carousel';

// ----------------------------------------------------------------------

// CONFIG.serverUrl มี /api/v1 ต่อท้ายอยู่แล้ว แต่รูปที่อัปโหลดเสิร์ฟจาก root ของ server ตรงๆ
// (server/src/app.js: app.use('/uploads', ...)) — ต้องตัด /api/v1 ออก
const SERVER_ORIGIN = CONFIG.serverUrl.replace(/\/api\/v1\/?$/, '');

// mount ครั้งเดียวใน DashboardLayout — ใช้ JUST_LOGGED_IN_KEY (ตั้งค่าตอน signInWithPassword
// สำเร็จ ใน src/auth/context/jwt/action.js) เพื่อแยก "เพิ่ง login มาใหม่" ออกจาก "แค่ refresh
// หน้า dashboard เดิม" — อ่านแล้วลบทิ้งทันทีเพื่อไม่ให้ popup ขึ้นซ้ำระหว่างเซสชันเดียวกัน
export function PostLoginPopup() {
  const [shouldFetch, setShouldFetch] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem(JUST_LOGGED_IN_KEY)) {
      sessionStorage.removeItem(JUST_LOGGED_IN_KEY);
      setShouldFetch(true);
    }
  }, []);

  const { images, imagesLoading } = useGetLoginPopupImagesForMe(shouldFetch);

  useEffect(() => {
    if (shouldFetch && !imagesLoading && images.length > 0) {
      setOpen(true);
    }
  }, [shouldFetch, imagesLoading, images.length]);

  const carousel = useCarousel({ loop: true }, [Autoplay({ playOnInit: true, delay: 4000 })]);

  const handleClose = () => setOpen(false);

  if (!open) return null;

  return (
    <Dialog fullWidth maxWidth="sm" open={open} onClose={handleClose}>
      <Box sx={{ position: 'relative' }}>
        <IconButton
          onClick={handleClose}
          sx={{
            position: 'absolute',
            right: 8,
            top: 8,
            zIndex: 9,
            color: 'common.white',
            bgcolor: 'rgba(22, 28, 36, 0.48)',
            '&:hover': { bgcolor: 'rgba(22, 28, 36, 0.72)' },
          }}
        >
          <Iconify icon="mingcute:close-line" />
        </IconButton>

        {images.length > 1 && (
          <CarouselDotButtons
            scrollSnaps={carousel.dots.scrollSnaps}
            selectedIndex={carousel.dots.selectedIndex}
            onClickDot={carousel.dots.onClickDot}
            sx={{
              bottom: 16,
              left: '50%',
              zIndex: 9,
              position: 'absolute',
              color: 'common.white',
              transform: 'translateX(-50%)',
            }}
          />
        )}

        <Carousel carousel={carousel}>
          {images.map((image) => (
            <Box
              key={image.id}
              sx={{
                height: { xs: 320, sm: 420 },
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: 'background.neutral',
              }}
            >
              <Box
                component="img"
                alt={`login-popup-${image.id}`}
                src={`${SERVER_ORIGIN}${image.image_url}`}
                sx={{ width: 1, height: 1, objectFit: 'contain' }}
              />
            </Box>
          ))}
        </Carousel>
      </Box>
    </Dialog>
  );
}
