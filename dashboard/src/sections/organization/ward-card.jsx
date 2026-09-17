'use client';

import { useState } from 'react';
import { CSS } from '@dnd-kit/utilities';
import { useSortable } from '@dnd-kit/sortable';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Avatar from '@mui/material/Avatar';
import Tooltip from '@mui/material/Tooltip';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';

import { useBoolean } from 'src/hooks/use-boolean';

import { deleteCabinet } from 'src/actions/cabinets';

import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';

import { ParLevelDialog, CabinetFormDialog } from './cabinet-dialogs';

// ----------------------------------------------------------------------

// การ์ดวอร์ด/แผนกหนึ่งใบ — ขยายใหญ่ขึ้นให้จัดการตู้เก็บผ้า + จำนวนผ้าที่ต้องมี (par level)
// ได้ตรงนี้เลย ไม่ต้องไปหน้าแยกอีกต่อไป (เดิมคือหน้า "ตู้เก็บผ้า & Par Level")
export function WardCard({ ward, cabinets, categories, hospitalId, onEdit, onDelete, onCabinetsChanged }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `ward-${ward.id}`,
    data: { type: 'ward', wardId: ward.id },
  });

  const cabinetFormDialog = useBoolean();
  const parLevelDialog = useBoolean();
  const [selectedCabinet, setSelectedCabinet] = useState(null);
  const [cabinetFormMode, setCabinetFormMode] = useState('create');

  const openCreateCabinet = () => {
    setSelectedCabinet(null);
    setCabinetFormMode('create');
    cabinetFormDialog.onTrue();
  };

  const openEditCabinet = (cabinet) => {
    setSelectedCabinet(cabinet);
    setCabinetFormMode('edit');
    cabinetFormDialog.onTrue();
  };

  const openParLevel = (cabinet) => {
    setSelectedCabinet(cabinet);
    parLevelDialog.onTrue();
  };

  const handleDeleteCabinet = async (cabinet) => {
    try {
      await deleteCabinet(cabinet.id);
      toast.success('ลบตู้สำเร็จ');
      onCabinetsChanged();
    } catch (error) {
      toast.error(error?.message || 'ลบไม่สำเร็จ');
    }
  };

  return (
    <Card
      ref={setNodeRef}
      variant="outlined"
      sx={{
        p: 2,
        pt: 1.75,
        minWidth: 300,
        flex: '1 1 340px',
        borderTop: (theme) => `3px solid ${theme.vars.palette.success.main}`,
        opacity: isDragging ? 0.5 : 1,
        transform: CSS.Transform.toString(transform),
        transition,
      }}
    >
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
        <Box
          {...attributes}
          {...listeners}
          data-testid={`ward-drag-handle-${ward.id}`}
          sx={{ display: 'flex', cursor: 'grab', touchAction: 'none' }}
        >
          <Iconify icon="mingcute:dot-grid-fill" width={18} sx={{ color: 'text.disabled' }} />
        </Box>

        <Avatar variant="rounded" sx={{ width: 36, height: 36, bgcolor: 'success.lighter', color: 'success.darker' }}>
          <Iconify icon="solar:hospital-bold-duotone" width={20} />
        </Avatar>

        <Typography
          variant="subtitle1"
          onClick={onEdit}
          sx={{ flexGrow: 1, cursor: 'pointer', '&:hover': { color: 'primary.main' } }}
        >
          {ward.name}
        </Typography>

        <Tooltip title="ลบแผนกนี้">
          <IconButton color="error" onClick={onDelete}>
            <Iconify icon="solar:trash-bin-trash-bold-duotone" width={18} />
          </IconButton>
        </Tooltip>
      </Stack>

      <Stack spacing={1}>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: 1.5,
          }}
        >
          {cabinets.map((cabinet) => (
            <Stack
              key={cabinet.id}
              justifyContent="space-between"
              sx={{
                p: 1.5,
                height: 108,
                borderRadius: 1.5,
                bgcolor: 'background.neutral',
              }}
            >
              <Stack direction="row" alignItems="center" spacing={1}>
                <Iconify icon="solar:box-bold-duotone" width={22} sx={{ color: 'text.secondary' }} />
                <Typography
                  variant="subtitle2"
                  sx={{
                    flexGrow: 1,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {cabinet.name}
                </Typography>
                <IconButton size="small" onClick={() => openEditCabinet(cabinet)}>
                  <Iconify icon="solar:pen-bold-duotone" width={16} />
                </IconButton>
                <IconButton size="small" color="error" onClick={() => handleDeleteCabinet(cabinet)}>
                  <Iconify icon="solar:trash-bin-trash-bold-duotone" width={16} />
                </IconButton>
              </Stack>

              <Button
                size="small"
                fullWidth
                variant="outlined"
                startIcon={<Iconify icon="solar:t-shirt-bold-duotone" width={14} />}
                onClick={() => openParLevel(cabinet)}
              >
                จำนวนผ้า
              </Button>
            </Stack>
          ))}
        </Box>

        <Button
          size="small"
          variant="text"
          startIcon={<Iconify icon="mingcute:add-line" width={16} />}
          onClick={openCreateCabinet}
          sx={{ alignSelf: 'flex-start' }}
        >
          เพิ่มตู้เก็บผ้า
        </Button>
      </Stack>

      <CabinetFormDialog
        open={cabinetFormDialog.value}
        onClose={cabinetFormDialog.onFalse}
        mode={cabinetFormMode}
        ward={ward}
        cabinet={selectedCabinet}
        onSaved={onCabinetsChanged}
      />

      <ParLevelDialog
        open={parLevelDialog.value}
        onClose={parLevelDialog.onFalse}
        cabinet={selectedCabinet}
        hospitalId={hospitalId}
        categories={categories}
      />
    </Card>
  );
}
