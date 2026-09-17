'use client';

import { CSS } from '@dnd-kit/utilities';
import { useSortable, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Tooltip from '@mui/material/Tooltip';
import { useTheme } from '@mui/material/styles';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';

import { varAlpha, bgGradient } from 'src/theme/styles';

import { Iconify } from 'src/components/iconify';

import { FloorBand } from './floor-band';

// ----------------------------------------------------------------------

// ตึกหนึ่งหลัง แสดงเป็นการ์ดทรงตึกจริง — มีป้ายหลังคา/เสาอากาศด้านบน, ผนังกระจกลายหน้าต่างตรงกลาง
// ที่บรรจุชั้นเรียงซ้อนกัน (ชั้นบนสุดของรายการ = แถบบนสุดของการ์ด), และฐานตึกด้านล่างไว้เพิ่มชั้นใหม่
export function BuildingBoard({
  building,
  cabinetsByWard,
  categories,
  hospitalId,
  onEditBuilding,
  onDeleteBuilding,
  onAddFloor,
  onEditFloor,
  onDeleteFloor,
  onAddWard,
  onEditWard,
  onDeleteWard,
  onCabinetsChanged,
}) {
  const theme = useTheme();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `building-${building.id}`,
    data: { type: 'building', buildingId: building.id },
  });

  return (
    <Box
      sx={{
        position: 'relative',
        pt: '16px',
        opacity: isDragging ? 0.5 : 1,
        transform: CSS.Transform.toString(transform),
        transition,
      }}
    >
      {/* เสาอากาศ + ไฟสัญญาณบนหลังคา */}
      <Box
        sx={{
          top: 0,
          left: '50%',
          width: 2,
          height: 16,
          position: 'absolute',
          bgcolor: 'text.disabled',
          transform: 'translateX(-50%)',
        }}
      />
      <Box
        sx={{
          top: -3,
          left: '50%',
          width: 7,
          height: 7,
          borderRadius: '50%',
          position: 'absolute',
          bgcolor: 'error.main',
          transform: 'translateX(-50%)',
          boxShadow: `0 0 6px 1px ${varAlpha(theme.vars.palette.error.mainChannel, 0.7)}`,
        }}
      />

      <Card
        ref={setNodeRef}
        sx={{
          overflow: 'hidden',
          borderRadius: 2.5,
          boxShadow: theme.customShadows?.z16 ?? theme.shadows[8],
        }}
      >
        {/* ป้ายหลังคาตึก */}
        <Stack
          direction="row"
          alignItems="center"
          spacing={1.5}
          sx={{
            py: 1.75,
            px: 2,
            color: 'common.white',
            ...bgGradient({
              color: `135deg, ${theme.vars.palette.primary.dark} 0%, ${theme.vars.palette.primary.darker} 100%`,
            }),
          }}
        >
          <Box
            {...attributes}
            {...listeners}
            sx={{
              width: 44,
              height: 44,
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 1.5,
              cursor: 'grab',
              touchAction: 'none',
              bgcolor: varAlpha(theme.vars.palette.common.whiteChannel, 0.16),
            }}
          >
            <Iconify icon="solar:buildings-2-bold-duotone" width={26} />
          </Box>

          <Stack sx={{ minWidth: 0, flexGrow: 1 }}>
            <Typography
              variant="h6"
              onClick={() => onEditBuilding(building)}
              sx={{
                cursor: 'pointer',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                '&:hover': { opacity: 0.8 },
              }}
            >
              {building.name}
            </Typography>
            <Chip
              size="small"
              label={`${building.children.length} ชั้น`}
              sx={{
                mt: 0.5,
                height: 20,
                alignSelf: 'flex-start',
                color: 'common.white',
                bgcolor: varAlpha(theme.vars.palette.common.whiteChannel, 0.16),
                '& .MuiChip-label': { px: 1, fontSize: 11 },
              }}
            />
          </Stack>

          <Tooltip title="ลบตึกนี้">
            <IconButton
              onClick={() => onDeleteBuilding(building)}
              sx={{ color: varAlpha(theme.vars.palette.common.whiteChannel, 0.8), '&:hover': { color: 'error.light' } }}
            >
              <Iconify icon="solar:trash-bin-trash-bold-duotone" width={18} />
            </IconButton>
          </Tooltip>
        </Stack>

        {/* ผนังตึก: ลายกระจก/หน้าต่างจาง ๆ เป็นพื้นหลัง ด้านในบรรจุชั้นต่าง ๆ */}
        <Box
          sx={{
            p: 1.5,
            backgroundImage: `repeating-linear-gradient(90deg, transparent, transparent 39px, ${varAlpha(theme.vars.palette.grey['500Channel'], 0.08)} 39px, ${varAlpha(theme.vars.palette.grey['500Channel'], 0.08)} 40px)`,
          }}
        >
          <SortableContext
            items={building.children.map((f) => `floor-${f.id}`)}
            strategy={verticalListSortingStrategy}
          >
            <Stack spacing={1}>
              {building.children.map((floor, index) => (
                <FloorBand
                  key={floor.id}
                  floor={floor}
                  floorIndex={index}
                  cabinetsByWard={cabinetsByWard}
                  categories={categories}
                  hospitalId={hospitalId}
                  onEditFloor={onEditFloor}
                  onDeleteFloor={onDeleteFloor}
                  onAddWard={onAddWard}
                  onEditWard={onEditWard}
                  onDeleteWard={onDeleteWard}
                  onCabinetsChanged={onCabinetsChanged}
                />
              ))}
            </Stack>
          </SortableContext>

          {building.children.length === 0 && (
            <Typography variant="caption" sx={{ color: 'text.disabled', display: 'block', textAlign: 'center', py: 2 }}>
              ยังไม่มีชั้นในตึกนี้
            </Typography>
          )}
        </Box>

        {/* ฐานตึก */}
        <Stack
          direction="row"
          justifyContent="center"
          sx={{
            py: 1,
            bgcolor: 'background.neutral',
            borderTop: (t) => `1px solid ${t.vars.palette.divider}`,
          }}
        >
          <Button
            size="small"
            variant="text"
            startIcon={<Iconify icon="mingcute:add-line" width={16} />}
            onClick={() => onAddFloor(building)}
          >
            เพิ่มชั้น
          </Button>
        </Stack>
      </Card>
    </Box>
  );
}
