'use client';

import { CSS } from '@dnd-kit/utilities';
import { useSortable, SortableContext, rectSortingStrategy } from '@dnd-kit/sortable';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Tooltip from '@mui/material/Tooltip';
import { useTheme } from '@mui/material/styles';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';

import { varAlpha } from 'src/theme/styles';

import { Iconify } from 'src/components/iconify';

import { WardCard } from './ward-card';

// ----------------------------------------------------------------------

// ดึงเลขชั้นจากชื่อ (เช่น "ชั้น 3" -> "3") มาใส่ป้ายวงกลมแบบจอบอกชั้นในลิฟต์ ถ้าไม่มีเลขใช้ไอคอนแทน
function getFloorBadgeLabel(name) {
  const match = String(name).match(/\d+/);
  return match ? match[0] : null;
}

// ชั้นหนึ่งชั้นในตึก — แสดงเป็นแผ่นพื้นชั้น มีป้ายเลขชั้นทรงกลมด้านซ้าย + drag handle จัดลำดับชั้น
// ด้านล่างเป็นการ์ดวอร์ด/แผนกของชั้นนี้ (ปกติชั้นนึงไม่เกิน 1-2 แผนก จึงให้การ์ดใหญ่ จัดการตู้เก็บผ้า/
// จำนวนผ้าได้ตรงนี้เลย)
export function FloorBand({
  floor,
  floorIndex = 0,
  cabinetsByWard,
  categories,
  hospitalId,
  onEditFloor,
  onDeleteFloor,
  onAddWard,
  onEditWard,
  onDeleteWard,
  onCabinetsChanged,
}) {
  const theme = useTheme();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `floor-${floor.id}`,
    data: { type: 'floor', floorId: floor.id },
  });

  const badgeLabel = getFloorBadgeLabel(floor.name);

  return (
    <Box
      ref={setNodeRef}
      data-testid={`floor-band-${floor.id}`}
      sx={{
        opacity: isDragging ? 0.5 : 1,
        transform: CSS.Transform.toString(transform),
        transition,
      }}
    >
      <Stack
        spacing={1.5}
        sx={{
          p: 1.5,
          borderRadius: 1.5,
          bgcolor: floorIndex % 2 === 0
            ? varAlpha(theme.vars.palette.background.paperChannel, 0.9)
            : 'background.neutral',
          border: (t) => `1px solid ${t.vars.palette.divider}`,
        }}
      >
        <Stack direction="row" alignItems="center" spacing={1.25}>
          <Box
            {...attributes}
            {...listeners}
            data-testid={`floor-drag-handle-${floor.id}`}
            sx={{ display: 'flex', alignItems: 'center', cursor: 'grab', touchAction: 'none' }}
          >
            <Iconify icon="mingcute:dot-grid-fill" width={16} sx={{ color: 'text.disabled' }} />
          </Box>

          <Box
            sx={{
              width: 30,
              height: 30,
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '50%',
              bgcolor: 'info.lighter',
              color: 'info.darker',
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            {badgeLabel ?? <Iconify icon="solar:layers-bold-duotone" width={16} />}
          </Box>

          <Typography
            variant="subtitle2"
            onClick={() => onEditFloor(floor)}
            sx={{ cursor: 'pointer', '&:hover': { color: 'primary.main' } }}
          >
            {floor.name}
          </Typography>

          <Typography variant="caption" sx={{ color: 'text.disabled' }}>
            ({floor.children.length} แผนก)
          </Typography>

          <Box sx={{ flexGrow: 1 }} />

          <Button
            size="small"
            variant="text"
            startIcon={<Iconify icon="mingcute:add-line" width={16} />}
            onClick={() => onAddWard(floor)}
          >
            เพิ่มแผนก
          </Button>

          <Tooltip title="ลบชั้นนี้">
            <IconButton size="small" color="error" onClick={() => onDeleteFloor(floor)}>
              <Iconify icon="solar:trash-bin-trash-bold-duotone" width={16} />
            </IconButton>
          </Tooltip>
        </Stack>

        {floor.children.length > 0 && (
          <SortableContext
            items={floor.children.map((w) => `ward-${w.id}`)}
            strategy={rectSortingStrategy}
          >
            <Stack direction="row" flexWrap="wrap" sx={{ gap: 1.5 }}>
              {floor.children.map((ward) => (
                <WardCard
                  key={ward.id}
                  ward={ward}
                  cabinets={cabinetsByWard.get(ward.id) ?? []}
                  categories={categories}
                  hospitalId={hospitalId}
                  onEdit={() => onEditWard(ward)}
                  onDelete={() => onDeleteWard(ward)}
                  onCabinetsChanged={onCabinetsChanged}
                />
              ))}
            </Stack>
          </SortableContext>
        )}
      </Stack>
    </Box>
  );
}
