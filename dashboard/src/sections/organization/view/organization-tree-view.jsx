'use client';

import { useMemo, useState, useCallback } from 'react';
import { SortableContext, rectSortingStrategy } from '@dnd-kit/sortable';
import { useSensor, DndContext, useSensors, closestCenter, PointerSensor } from '@dnd-kit/core';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';

import { useBoolean } from 'src/hooks/use-boolean';
import { useEffectiveHospital } from 'src/hooks/use-effective-hospital';

import { useGetCabinets } from 'src/actions/cabinets';
import { DashboardContent } from 'src/layouts/dashboard';
import { useGetFabricCategories } from 'src/actions/fabric';
import { updateDepartment, deleteDepartment, useGetDepartments } from 'src/actions/departments';

import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';
import { EmptyContent } from 'src/components/empty-content';
import { LoadingScreen } from 'src/components/loading-screen';
import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';
import { HospitalContextChip } from 'src/components/hospital-context-chip';

import { useAuthContext } from 'src/auth/hooks';
import { RoleBasedGuard } from 'src/auth/guard';

import { BuildingBoard } from '../building-board';
import { DepartmentFormDialog } from '../department-form-dialog';
import { LEVEL_LABEL, buildDepartmentTree } from '../organization-constants';

// ----------------------------------------------------------------------

// "sortableId" คือ `${type}-${id}` เช่น "floor-12" — แยกกลับเป็น { type, id } เพื่อหา sibling
// array ที่ถูกต้องมาคำนวณตำแหน่งใหม่ตอนลากวาง
function parseSortableId(sortableId) {
  const [type, rawId] = String(sortableId).split('-');
  return { type, id: Number(rawId) };
}

function findSiblingArray(tree, type, id) {
  if (type === 'building') return tree;

  if (type === 'floor') {
    const building = tree.find((b) => b.children.some((f) => f.id === id));
    return building?.children ?? null;
  }

  if (type === 'ward') {
    const floor = tree.flatMap((b) => b.children).find((f) => f.children.some((w) => w.id === id));
    return floor?.children ?? null;
  }

  return null;
}

export function OrganizationTreeView() {
  const { user } = useAuthContext();
  const { hospitalId } = useEffectiveHospital();

  const { departments, departmentsLoading, refreshDepartments } = useGetDepartments(hospitalId);
  const { cabinets, refreshCabinets } = useGetCabinets(hospitalId);
  const { categories } = useGetFabricCategories(hospitalId);

  const cabinetsByWard = useMemo(() => {
    const map = new Map();
    cabinets.forEach((cabinet) => {
      const list = map.get(cabinet.department_id) ?? [];
      list.push(cabinet);
      map.set(cabinet.department_id, list);
    });
    return map;
  }, [cabinets]);

  const formDialog = useBoolean();
  const [formState, setFormState] = useState({
    mode: 'create',
    levelType: 'BUILDING',
    parent: null,
    department: null,
  });

  const deleteDialog = useBoolean();
  const [deleteTarget, setDeleteTarget] = useState(null);

  const tree = buildDepartmentTree(departments);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const openCreate = useCallback(
    (parent) => {
      setFormState({
        mode: 'create',
        levelType: parent ? (parent.level_type === 'BUILDING' ? 'FLOOR' : 'WARD') : 'BUILDING',
        parent,
        department: null,
      });
      formDialog.onTrue();
    },
    [formDialog]
  );

  const openEdit = useCallback(
    (department) => {
      setFormState({ mode: 'edit', levelType: department.level_type, parent: null, department });
      formDialog.onTrue();
    },
    [formDialog]
  );

  const handleDeleteClick = useCallback(
    (department) => {
      setDeleteTarget(department);
      deleteDialog.onTrue();
    },
    [deleteDialog]
  );

  const handleConfirmDelete = useCallback(async () => {
    try {
      await deleteDepartment(deleteTarget.id);
      toast.success('ลบสำเร็จ');
      refreshDepartments();
    } catch (error) {
      toast.error(error?.message || 'ลบไม่สำเร็จ');
    } finally {
      deleteDialog.onFalse();
      setDeleteTarget(null);
    }
  }, [deleteTarget, deleteDialog, refreshDepartments]);

  const handleDragEnd = useCallback(
    async (event) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const activeMeta = parseSortableId(active.id);
      const overMeta = parseSortableId(over.id);
      if (activeMeta.type !== overMeta.type) return;

      const siblings = findSiblingArray(tree, activeMeta.type, activeMeta.id);
      if (!siblings) return;

      const newIndex = siblings.findIndex((s) => s.id === overMeta.id);
      if (newIndex === -1) return;

      try {
        await updateDepartment(activeMeta.id, { sortOrder: newIndex });
        refreshDepartments();
      } catch (error) {
        toast.error(error?.message || 'จัดลำดับไม่สำเร็จ');
      }
    },
    [tree, refreshDepartments]
  );

  return (
    <RoleBasedGuard hasContent currentRole={user?.role} acceptRoles={['SUPERADMIN', 'ADMIN']}>
      <DashboardContent maxWidth="xl">
        <HospitalContextChip sx={{ mb: 1.5 }} />

        <CustomBreadcrumbs
          heading="ผังโครงสร้างโรงพยาบาล"
          links={[{ name: 'โครงสร้างโรงพยาบาล' }, { name: 'ผังโครงสร้าง' }]}
          action={
            <Button
              variant="contained"
              startIcon={<Iconify icon="mingcute:add-line" />}
              onClick={() => openCreate(null)}
              disabled={!hospitalId}
            >
              เพิ่มอาคาร
            </Button>
          }
          sx={{ mb: { xs: 3, md: 5 } }}
        />

        <Typography variant="caption" sx={{ color: 'text.secondary', mb: 2, display: 'block' }}>
          ลาก (ไอคอนจุด) เพื่อจัดลำดับตึก / ชั้น / แผนก ภายในระดับเดียวกันได้อิสระ ไม่ต้องเรียงเลขชั้นให้ครบ
          — จัดการตู้เก็บผ้าและจำนวนผ้าที่ต้องมี (par level) ได้ในการ์ดแผนกแต่ละใบเลย
        </Typography>

        {!hospitalId ? (
          <Card sx={{ p: 2 }}>
            <EmptyContent title="กรุณาเลือกโรงพยาบาลก่อน" sx={{ py: 10 }} />
          </Card>
        ) : departmentsLoading ? (
          <Card sx={{ p: 2 }}>
            <LoadingScreen />
          </Card>
        ) : tree.length === 0 ? (
          <Card sx={{ p: 2 }}>
            <EmptyContent title="ยังไม่มีโครงสร้างอาคารในโรงพยาบาลนี้" sx={{ py: 10 }} />
          </Card>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={tree.map((b) => `building-${b.id}`)}
              strategy={rectSortingStrategy}
            >
              <Box
                sx={{
                  display: 'grid',
                  gap: 3,
                  alignItems: 'start',
                  gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' },
                }}
              >
                {tree.map((building) => (
                  <BuildingBoard
                    key={building.id}
                    building={building}
                    cabinetsByWard={cabinetsByWard}
                    categories={categories}
                    hospitalId={hospitalId}
                    onEditBuilding={openEdit}
                    onDeleteBuilding={handleDeleteClick}
                    onAddFloor={openCreate}
                    onEditFloor={openEdit}
                    onDeleteFloor={handleDeleteClick}
                    onAddWard={openCreate}
                    onEditWard={openEdit}
                    onDeleteWard={handleDeleteClick}
                    onCabinetsChanged={refreshCabinets}
                  />
                ))}
              </Box>
            </SortableContext>
          </DndContext>
        )}

        <DepartmentFormDialog
          open={formDialog.value}
          onClose={formDialog.onFalse}
          mode={formState.mode}
          levelType={formState.levelType}
          parent={formState.parent}
          department={formState.department}
          hospitalId={hospitalId}
          onSaved={refreshDepartments}
        />

        <Dialog open={deleteDialog.value} onClose={deleteDialog.onFalse} maxWidth="xs" fullWidth>
          <DialogTitle>ยืนยันการลบ</DialogTitle>
          <DialogContent>
            <Typography variant="body2">
              ต้องการลบ
              {deleteTarget
                ? ` ${LEVEL_LABEL[deleteTarget.level_type]} "${deleteTarget.name}"`
                : ''}{' '}
              ใช่หรือไม่? (ต้องไม่มีแผนกย่อยหรือตู้ผูกอยู่)
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button color="inherit" onClick={deleteDialog.onFalse}>
              ยกเลิก
            </Button>
            <Button variant="contained" color="error" onClick={handleConfirmDelete}>
              ลบ
            </Button>
          </DialogActions>
        </Dialog>
      </DashboardContent>
    </RoleBasedGuard>
  );
}
