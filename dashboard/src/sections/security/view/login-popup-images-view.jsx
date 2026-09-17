'use client';

import { useState } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Button from '@mui/material/Button';
import Tooltip from '@mui/material/Tooltip';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import CardContent from '@mui/material/CardContent';

import { useBoolean } from 'src/hooks/use-boolean';

import { CONFIG } from 'src/config-global';
import { DashboardContent } from 'src/layouts/dashboard';
import {
  updateLoginPopupImage,
  deleteLoginPopupImage,
  useGetLoginPopupImages,
} from 'src/actions/loginPopupImages';

import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';
import { EmptyContent } from 'src/components/empty-content';
import { LoadingScreen } from 'src/components/loading-screen';
import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';

import { useAuthContext } from 'src/auth/hooks';
import { RoleBasedGuard } from 'src/auth/guard';

import { ROLE_LABEL, ROLE_COLOR } from './user-list-shared';
import { LoginPopupImageDialog } from './login-popup-image-dialog';

// ----------------------------------------------------------------------

// CONFIG.serverUrl มี /api/v1 ต่อท้ายอยู่แล้ว แต่รูปที่อัปโหลดเสิร์ฟจาก root ของ server ตรงๆ
// (server/src/app.js: app.use('/uploads', ...)) — ต้องตัด /api/v1 ออกเหมือน fabric-hold-view.jsx
const SERVER_ORIGIN = CONFIG.serverUrl.replace(/\/api\/v1\/?$/, '');

export function LoginPopupImagesView() {
  const { user } = useAuthContext();
  const { images, imagesLoading, refreshImages } = useGetLoginPopupImages();

  const dialog = useBoolean();
  const [editTarget, setEditTarget] = useState(null);

  const openCreate = () => {
    setEditTarget(null);
    dialog.onTrue();
  };

  const openEdit = (image) => {
    setEditTarget(image);
    dialog.onTrue();
  };

  const handleToggleActive = async (image) => {
    const formData = new FormData();
    formData.append('isActive', String(!image.is_active));
    try {
      await updateLoginPopupImage(image.id, formData);
      refreshImages();
    } catch (error) {
      toast.error(error?.message || 'บันทึกไม่สำเร็จ');
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteLoginPopupImage(id);
      toast.success('ลบรูปภาพสำเร็จ');
      refreshImages();
    } catch (error) {
      toast.error(error?.message || 'ลบไม่สำเร็จ');
    }
  };

  return (
    <RoleBasedGuard hasContent currentRole={user?.role} acceptRoles={['SUPERADMIN']}>
      <DashboardContent>
        <Stack spacing={1} sx={{ mb: { xs: 3, md: 5 } }}>
          <CustomBreadcrumbs
            heading="Popup รูปภาพหลัง Login"
            links={[{ name: 'ความปลอดภัย & ตั้งค่าระบบ' }, { name: 'Popup หลัง Login' }]}
            action={
              <Button
                variant="contained"
                startIcon={<Iconify icon="mingcute:add-line" />}
                onClick={openCreate}
              >
                เพิ่มรูปภาพ
              </Button>
            }
          />
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            รูปภาพที่กำหนดให้บทบาทใดเห็นได้ จะแสดงเป็น popup พร้อมปุ่มปิดทุกครั้งหลัง login สำเร็จ —
            ถ้าบทบาทหนึ่งมีหลายรูป ระบบจะรวมเป็น slider ใน popup เดียวกันเรียงตามลำดับที่กำหนด
          </Typography>
        </Stack>

        {imagesLoading ? (
          <LoadingScreen />
        ) : images.length === 0 ? (
          <EmptyContent title="ยังไม่มีรูปภาพ Popup" sx={{ py: 10 }} />
        ) : (
          <Grid container spacing={3}>
            {images.map((image) => (
              <Grid item xs={12} sm={6} md={4} key={image.id}>
                <Card>
                  <Box
                    sx={{
                      height: 200,
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
                  <CardContent>
                    <Stack direction="row" flexWrap="wrap" spacing={0.5} sx={{ mb: 1.5 }}>
                      {image.roles.map((role) => (
                        <Chip key={role} size="small" label={ROLE_LABEL[role]} color={ROLE_COLOR[role]} />
                      ))}
                    </Stack>

                    <Stack direction="row" alignItems="center" justifyContent="space-between">
                      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                        ลำดับ: {image.sort_order}
                      </Typography>

                      <Box>
                        <Tooltip title={image.is_active ? 'ใช้งานอยู่' : 'ปิดใช้งาน'}>
                          <Switch
                            checked={image.is_active}
                            onChange={() => handleToggleActive(image)}
                          />
                        </Tooltip>
                        <Tooltip title="แก้ไข">
                          <IconButton onClick={() => openEdit(image)}>
                            <Iconify icon="solar:pen-bold" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="ลบ">
                          <IconButton color="error" onClick={() => handleDelete(image.id)}>
                            <Iconify icon="solar:trash-bin-trash-bold" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}

        <LoginPopupImageDialog
          open={dialog.value}
          onClose={dialog.onFalse}
          target={editTarget}
          onSaved={refreshImages}
        />
      </DashboardContent>
    </RoleBasedGuard>
  );
}
