'use client';

import { useRef, useState } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Tooltip from '@mui/material/Tooltip';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import LinearProgress from '@mui/material/LinearProgress';
import LoadingButton from '@mui/lab/LoadingButton';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';
import { resolveUploadUrl } from 'src/utils/resolve-upload-url';

import {
  useGetPhoneModel,
  updatePhoneModel,
  uploadPhoneModelImages,
  deletePhoneModelImage,
} from 'src/actions/phoneModels';

import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';
import { LoadingScreen } from 'src/components/loading-screen';
import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';

const SUFFICIENCY_COLOR = { good: 'success', medium: 'warning', low: 'error' };
const SUFFICIENCY_PERCENT = { good: 100, medium: 60, low: 25 };

export function PhoneModelDetailsView({ id }) {
  const { model, images, advice, modelLoading, refreshModel } = useGetPhoneModel(id);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const handleFilesSelected = async (event) => {
    const files = event.target.files;
    if (!files?.length) return;
    setUploading(true);
    try {
      await uploadPhoneModelImages(id, files);
      toast.success(`อัพโหลดแล้ว ${files.length} ภาพ — กด "ประมวลผลใหม่" ที่หน้ารายการเพื่อให้ระบบเรียนรู้`);
      refreshModel();
    } catch (error) {
      toast.error(error?.message || 'อัพโหลดไม่สำเร็จ');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeleteImage = async (imageId) => {
    try {
      await deletePhoneModelImage(id, imageId);
      toast.success('ลบภาพแล้ว');
      refreshModel();
    } catch (error) {
      toast.error(error?.message || 'ลบไม่สำเร็จ');
    }
  };

  const handleSetCover = async (imageId) => {
    try {
      await updatePhoneModel(id, { coverImageId: imageId });
      toast.success('ตั้งเป็นภาพหลักแล้ว');
      refreshModel();
    } catch (error) {
      toast.error(error?.message || 'ตั้งค่าไม่สำเร็จ');
    }
  };

  if (modelLoading) return <LoadingScreen />;
  if (!model) return null;

  return (
    <>
      <CustomBreadcrumbs
        heading={`${model.brand} ${model.model_name}`}
        links={[
          { name: 'ข้อมูลรุ่นโทรศัพท์', href: paths.dashboard.phone.models },
          { name: `${model.brand} ${model.model_name}` },
        ]}
        sx={{ mb: { xs: 2, md: 3 } }}
      />

      <Card sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Typography variant="subtitle1">ความพร้อมของข้อมูลอ้างอิง</Typography>
          <Typography variant="body2" sx={{ color: `${SUFFICIENCY_COLOR[model.sufficiency.level]}.main`, fontWeight: 600 }}>
            {model.imageCount} ภาพ · {model.sufficiency.label}
          </Typography>
        </Box>
        <LinearProgress
          variant="determinate"
          value={SUFFICIENCY_PERCENT[model.sufficiency.level]}
          color={SUFFICIENCY_COLOR[model.sufficiency.level]}
          sx={{ height: 8, borderRadius: 1, mb: 1.5 }}
        />
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          {advice}
        </Typography>
      </Card>

      <Card sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="subtitle1">ภาพอ้างอิง ({images.length})</Typography>
          <LoadingButton
            variant="contained"
            component="label"
            loading={uploading}
            startIcon={<Iconify icon="solar:gallery-add-bold-duotone" />}
          >
            เพิ่มภาพ
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp"
              hidden
              onChange={handleFilesSelected}
            />
          </LoadingButton>
        </Box>

        {images.length === 0 ? (
          <Typography variant="body2" sx={{ color: 'text.disabled', py: 4, textAlign: 'center' }}>
            ยังไม่มีภาพอ้างอิงของรุ่นนี้
          </Typography>
        ) : (
          <Grid container spacing={2}>
            {images.map((image) => {
              const isCover = model.cover_image_path === image.image_path;
              return (
                <Grid item key={image.id} xs={6} sm={4} md={3}>
                  <Box sx={{ position: 'relative', borderRadius: 1.5, overflow: 'hidden' }}>
                    <Box
                      component="img"
                      src={resolveUploadUrl(image.image_path)}
                      sx={{
                        width: '100%',
                        height: 140,
                        objectFit: 'cover',
                        display: 'block',
                        ...(isCover && { outline: '3px solid', outlineColor: 'primary.main' }),
                      }}
                    />
                    {isCover && (
                      <Box
                        sx={{
                          position: 'absolute',
                          bottom: 6,
                          left: 6,
                          px: 0.75,
                          py: 0.25,
                          borderRadius: 0.75,
                          bgcolor: 'primary.main',
                          color: 'primary.contrastText',
                          typography: 'caption',
                          fontWeight: 700,
                        }}
                      >
                        ภาพหลัก
                      </Box>
                    )}
                    {!image.embedded_at && (
                      <Tooltip title="ยังไม่ถูกประมวลผลเข้าฐานข้อมูล">
                        <Box
                          sx={{
                            position: 'absolute',
                            top: 6,
                            left: 6,
                            px: 0.75,
                            py: 0.25,
                            borderRadius: 0.75,
                            bgcolor: 'warning.main',
                            color: 'warning.contrastText',
                            typography: 'caption',
                            fontWeight: 700,
                          }}
                        >
                          รอประมวลผล
                        </Box>
                      </Tooltip>
                    )}
                    <Stack direction="row" spacing={0.5} sx={{ position: 'absolute', top: 4, right: 4 }}>
                      {!isCover && (
                        <Tooltip title="ตั้งเป็นภาพหลัก">
                          <IconButton
                            size="small"
                            onClick={() => handleSetCover(image.id)}
                            sx={{
                              bgcolor: 'rgba(0,0,0,0.5)',
                              color: 'common.white',
                              '&:hover': { bgcolor: 'rgba(0,0,0,0.7)' },
                            }}
                          >
                            <Iconify icon="solar:star-bold" width={16} />
                          </IconButton>
                        </Tooltip>
                      )}
                      <IconButton
                        size="small"
                        onClick={() => handleDeleteImage(image.id)}
                        sx={{
                          bgcolor: 'rgba(0,0,0,0.5)',
                          color: 'common.white',
                          '&:hover': { bgcolor: 'rgba(0,0,0,0.7)' },
                        }}
                      >
                        <Iconify icon="solar:trash-bin-trash-bold" width={16} />
                      </IconButton>
                    </Stack>
                  </Box>
                </Grid>
              );
            })}
          </Grid>
        )}
      </Card>

      <Box sx={{ mt: 3 }}>
        <Button
          component={RouterLink}
          href={paths.dashboard.phone.models}
          startIcon={<Iconify icon="eva:arrow-ios-back-fill" />}
        >
          กลับไปหน้ารายการรุ่น
        </Button>
      </Box>
    </>
  );
}
