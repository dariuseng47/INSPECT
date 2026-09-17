'use client';

import { useMemo, useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Dialog from '@mui/material/Dialog';
import Switch from '@mui/material/Switch';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';
import DialogTitle from '@mui/material/DialogTitle';
import ToggleButton from '@mui/material/ToggleButton';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import FormControlLabel from '@mui/material/FormControlLabel';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';

import { useGetHospitals } from 'src/actions/hospitals';
import { updateUser, useGetMyHospitals } from 'src/actions/users';
import { useGetUserPermissions, updateUserPermissions } from 'src/actions/permissions';

import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';
import { LoadingScreen } from 'src/components/loading-screen';

import { useAuthContext } from 'src/auth/hooks';

// ----------------------------------------------------------------------

const CATEGORY_LABELS = {
  dashboard: 'แดชบอร์ดโรงพยาบาล',
  operations: 'ปฏิบัติการ & ติดตามผ้า',
  fabric: 'จัดการผ้าและล็อต',
  structure: 'โครงสร้างโรงพยาบาล',
  device: 'อุปกรณ์ & สัญญาณ RFID',
  security: 'ความปลอดภัย & ตั้งค่าระบบ',
  inventory: 'คลังผ้า',
};

// รวม permission รายคีย์ view/edit เป็นโมดูลเดียว ต่อ 1 แถวในตาราง
function toModules(permissions, channel) {
  const byBase = new Map();
  permissions
    .filter((p) => p.channel === channel)
    .forEach((p) => {
      if (!byBase.has(p.base)) {
        byBase.set(p.base, {
          base: p.base,
          label: p.label,
          category: p.category,
          actions: {},
        });
      }
      byBase.get(p.base).actions[p.action] = p;
    });

  const groups = new Map();
  [...byBase.values()].forEach((mod) => {
    if (!groups.has(mod.category)) groups.set(mod.category, []);
    groups.get(mod.category).push(mod);
  });
  return [...groups.entries()].map(([category, modules]) => ({
    category,
    label: CATEGORY_LABELS[category] ?? category,
    modules,
  }));
}

// ----------------------------------------------------------------------

export function PermissionEditorDialog({ open, onClose, targetUser, onSaved }) {
  const { user: actor } = useAuthContext();
  const isSuperadminActor = actor?.role === 'SUPERADMIN';
  const targetIsAdmin = targetUser?.role === 'ADMIN';
  const targetIsSuperadmin = targetUser?.role === 'SUPERADMIN';

  const {
    permissions,
    scopes,
    handheldEnabled,
    canManageSubordinates,
    permissionsLoading,
    refreshPermissions,
  } = useGetUserPermissions(open ? targetUser?.id : undefined);

  // รายชื่อโรงพยาบาลที่ "ผู้ตั้งค่า" มอบให้ได้ — superadmin เห็นทุกแห่ง, admin เห็นเฉพาะ scope ตัวเอง
  const { hospitals: allHospitals } = useGetHospitals(open && isSuperadminActor);
  const { myHospitals } = useGetMyHospitals(open && !isSuperadminActor);
  const assignableHospitals = isSuperadminActor
    ? allHospitals.map((h) => ({ id: h.id, name: h.name, canGrantEdit: true }))
    : myHospitals.map((h) => ({ id: h.id, name: h.name, canGrantEdit: h.canEdit }));

  const [tab, setTab] = useState('web');
  const [permLocal, setPermLocal] = useState({});
  const [resetKeys, setResetKeys] = useState(() => new Set());
  const [scopeLocal, setScopeLocal] = useState({}); // { [hospitalId]: 'none'|'view'|'edit' }
  const [handheldLocal, setHandheldLocal] = useState(true);
  const [manageLocal, setManageLocal] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || permissionsLoading) return;
    setPermLocal(Object.fromEntries(permissions.map((p) => [p.key, p.effective])));
    setResetKeys(new Set());
    setScopeLocal(
      Object.fromEntries(scopes.map((s) => [s.hospitalId, s.canEdit ? 'edit' : 'view']))
    );
    setHandheldLocal(!!handheldEnabled);
    setManageLocal(!!canManageSubordinates);
    setTab('web');
  }, [open, permissionsLoading, permissions, scopes, handheldEnabled, canManageSubordinates]);

  const webGroups = useMemo(() => toModules(permissions, 'web'), [permissions]);
  const handheldGroups = useMemo(() => toModules(permissions, 'handheld'), [permissions]);
  const permByKey = useMemo(
    () => Object.fromEntries(permissions.map((p) => [p.key, p])),
    [permissions]
  );

  const scopeDirty = useMemo(() => {
    const orig = Object.fromEntries(
      scopes.map((s) => [s.hospitalId, s.canEdit ? 'edit' : 'view'])
    );
    const ids = new Set([...Object.keys(orig), ...Object.keys(scopeLocal)]);
    return [...ids].some((id) => (orig[id] ?? 'none') !== (scopeLocal[id] ?? 'none'));
  }, [scopes, scopeLocal]);

  const hasChanges =
    resetKeys.size > 0 ||
    permissions.some((p) => permLocal[p.key] !== p.effective) ||
    scopeDirty ||
    (!targetIsSuperadmin && handheldLocal !== !!handheldEnabled) ||
    (targetIsAdmin && isSuperadminActor && manageLocal !== !!canManageSubordinates);

  const togglePerm = (key, checked) => {
    setPermLocal((prev) => ({ ...prev, [key]: checked }));
    setResetKeys((prev) => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  };

  const resetPerm = (perm) => {
    setPermLocal((prev) => ({ ...prev, [perm.key]: perm.roleDefault }));
    setResetKeys((prev) => new Set(prev).add(perm.key));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // 1) scope โรงพยาบาล + ธง handheld / สร้างพนักงาน -> PATCH /users/:id
      const userPatch = {};
      if (scopeDirty) {
        userPatch.hospitalScopes = Object.entries(scopeLocal)
          .filter(([, v]) => v !== 'none')
          .map(([hospitalId, v]) => ({ hospitalId: Number(hospitalId), canEdit: v === 'edit' }));
      }
      if (!targetIsSuperadmin && handheldLocal !== !!handheldEnabled) {
        userPatch.handheldEnabled = handheldLocal;
      }
      if (targetIsAdmin && isSuperadminActor && manageLocal !== !!canManageSubordinates) {
        userPatch.canManageSubordinates = manageLocal;
      }
      if (Object.keys(userPatch).length) {
        await updateUser(targetUser.id, userPatch);
      }

      // 2) สิทธิ์เมนู -> PUT /users/:id/permissions
      const overrides = [];
      permissions.forEach((p) => {
        if (resetKeys.has(p.key)) {
          overrides.push({ permKey: p.key, effect: null });
        } else if (permLocal[p.key] !== p.effective) {
          overrides.push({ permKey: p.key, effect: permLocal[p.key] ? 'GRANT' : 'DENY' });
        }
      });
      if (overrides.length) {
        await updateUserPermissions(targetUser.id, overrides);
      }

      toast.success('บันทึกสิทธิ์การเข้าถึงสำเร็จ');
      refreshPermissions();
      onSaved?.();
      onClose();
    } catch (error) {
      toast.error(error?.message || 'บันทึกไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  const renderModuleRow = (mod) => {
    const {view} = mod.actions;
    const {edit} = mod.actions;
    const locked = (p) => p?.superadminLocked && !isSuperadminActor;

    return (
      <Stack
        key={mod.base}
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{ py: 1 }}
      >
        <Stack direction="row" spacing={0.75} alignItems="center" sx={{ minWidth: 0 }}>
          <Typography variant="body2" noWrap>
            {mod.label}
          </Typography>
          {(locked(view) || locked(edit)) && (
            <Tooltip title="ตั้งค่าโดย superadmin — แก้ไขไม่ได้">
              <Iconify icon="solar:lock-keyhole-bold" width={16} sx={{ color: 'text.disabled' }} />
            </Tooltip>
          )}
        </Stack>

        <Stack direction="row" spacing={2}>
          <FormControlLabel
            labelPlacement="top"
            sx={{ m: 0, '& .MuiFormControlLabel-label': { fontSize: 12, color: 'text.secondary' } }}
            control={
              <Switch
                size="small"
                checked={view ? !!permLocal[view.key] : false}
                disabled={!view || locked(view)}
                onChange={(e) => togglePerm(view.key, e.target.checked)}
              />
            }
            label="ดู"
          />
          <FormControlLabel
            labelPlacement="top"
            sx={{ m: 0, '& .MuiFormControlLabel-label': { fontSize: 12, color: 'text.secondary' } }}
            control={
              <Switch
                size="small"
                checked={edit ? !!permLocal[edit.key] : false}
                disabled={!edit || locked(edit)}
                onChange={(e) => togglePerm(edit.key, e.target.checked)}
              />
            }
            label="แก้ไข"
          />
        </Stack>
      </Stack>
    );
  };

  const renderGroups = (groups) =>
    groups.map((g) => (
      <Box key={g.category} sx={{ mb: 1.5 }}>
        <Typography variant="overline" sx={{ color: 'text.secondary' }}>
          {g.label}
        </Typography>
        <Divider sx={{ my: 0.5 }} />
        <Stack divider={<Divider flexItem />}>{g.modules.map(renderModuleRow)}</Stack>
      </Box>
    ));

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        สิทธิ์การเข้าถึง — {targetUser?.full_name}
        <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
          {targetUser?.username} · {targetUser?.role}
        </Typography>
      </DialogTitle>

      <DialogContent sx={{ pb: 2 }}>
        {permissionsLoading ? (
          <LoadingScreen sx={{ height: 240 }} />
        ) : (
          <>
            <Tabs value={tab} onChange={(e, v) => setTab(v)} sx={{ mb: 2 }}>
              {!targetIsSuperadmin && <Tab value="hospitals" label="โรงพยาบาล" />}
              <Tab value="web" label="เมนูเว็บ" />
              <Tab value="handheld" label="เมนูมือถือ" />
              {targetIsAdmin && isSuperadminActor && <Tab value="other" label="อื่นๆ" />}
            </Tabs>

            {tab === 'hospitals' && !targetIsSuperadmin && (
              <Stack spacing={1.5}>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  เลือกว่าบัญชีนี้เข้าถึงข้อมูลของโรงพยาบาลใดได้บ้าง และแต่ละแห่งให้ดูอย่างเดียว
                  หรือแก้ไขได้
                </Typography>
                {assignableHospitals.length === 0 && (
                  <Typography variant="body2" sx={{ color: 'text.disabled' }}>
                    ไม่มีโรงพยาบาลให้มอบสิทธิ์
                  </Typography>
                )}
                {assignableHospitals.map((h) => {
                  const val = scopeLocal[h.id] ?? 'none';
                  return (
                    <Stack
                      key={h.id}
                      direction="row"
                      alignItems="center"
                      justifyContent="space-between"
                      sx={{ py: 0.5 }}
                    >
                      <Typography variant="body2">{h.name}</Typography>
                      <ToggleButtonGroup
                        exclusive
                        size="small"
                        value={val}
                        onChange={(e, v) => {
                          if (v !== null) setScopeLocal((prev) => ({ ...prev, [h.id]: v }));
                        }}
                      >
                        <ToggleButton value="none">ไม่มีสิทธิ์</ToggleButton>
                        <ToggleButton value="view">ดูอย่างเดียว</ToggleButton>
                        <ToggleButton value="edit" disabled={!h.canGrantEdit}>
                          แก้ไขได้
                        </ToggleButton>
                      </ToggleButtonGroup>
                    </Stack>
                  );
                })}
              </Stack>
            )}

            {tab === 'web' && (
              <Stack spacing={0.5}>
                <PendingResetHint
                  permissions={permissions}
                  permLocal={permLocal}
                  permByKey={permByKey}
                  resetKeys={resetKeys}
                  onReset={resetPerm}
                  channel="web"
                />
                {renderGroups(webGroups)}
              </Stack>
            )}

            {tab === 'handheld' && (
              <Stack spacing={1.5}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={handheldLocal}
                      disabled={targetIsSuperadmin}
                      onChange={(e) => setHandheldLocal(e.target.checked)}
                    />
                  }
                  label={
                    <Typography variant="subtitle2">
                      อนุญาตให้ใช้งานเครื่องพกพา (handheld)
                    </Typography>
                  }
                />
                <Box sx={{ opacity: handheldLocal ? 1 : 0.4, pointerEvents: handheldLocal ? 'auto' : 'none' }}>
                  {renderGroups(handheldGroups)}
                </Box>
              </Stack>
            )}

            {tab === 'other' && targetIsAdmin && isSuperadminActor && (
              <Stack spacing={1.5}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={manageLocal}
                      onChange={(e) => setManageLocal(e.target.checked)}
                    />
                  }
                  label={
                    <Typography variant="subtitle2">
                      อนุญาตให้สร้าง / แก้ไข / ลบ พนักงาน (operator) ใต้ตัวเอง
                    </Typography>
                  }
                />
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  พนักงานที่แอดมินคนนี้สร้าง จะได้สิทธิ์ไม่เกินสิทธิ์ของแอดมิน — superadmin
                  ปรับเพิ่มให้เกินเพดานได้จากหน้านี้ และค่าที่ superadmin ตั้งจะถูกล็อกไม่ให้แอดมินแก้ทับ
                </Typography>
              </Stack>
            )}
          </>
        )}
      </DialogContent>

      <DialogActions>
        <Button color="inherit" onClick={onClose}>
          ยกเลิก
        </Button>
        <LoadingButton
          variant="contained"
          loading={saving}
          disabled={!hasChanges}
          onClick={handleSave}
        >
          บันทึก
        </LoadingButton>
      </DialogActions>
    </Dialog>
  );
}

// แถวสรุปคีย์ที่ถูกปรับเฉพาะบุคคล (override) + ปุ่มรีเซ็ตกลับค่าเริ่มต้นของบทบาท
function PendingResetHint({ permissions, permLocal, permByKey, resetKeys, onReset, channel }) {
  const overridden = permissions.filter(
    (p) =>
      p.channel === channel &&
      !resetKeys.has(p.key) &&
      p.source === 'override' &&
      permLocal[p.key] === permByKey[p.key]?.effective
  );
  if (!overridden.length) return null;
  return (
    <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mb: 1 }}>
      {overridden.map((p) => (
        <Chip
          key={p.key}
          size="small"
          variant="soft"
          color="warning"
          label={`${p.label} · ${p.action === 'edit' ? 'แก้ไข' : 'ดู'}`}
          onDelete={() => onReset(p)}
          deleteIcon={<Iconify icon="solar:restart-bold" />}
        />
      ))}
    </Stack>
  );
}
