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
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import FormControlLabel from '@mui/material/FormControlLabel';

import { updateUser } from 'src/actions/users';
import { useGetUserPermissions, updateUserPermissions } from 'src/actions/permissions';

import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';
import { LoadingScreen } from 'src/components/loading-screen';

import { useAuthContext } from 'src/auth/hooks';

// ----------------------------------------------------------------------

const CATEGORY_LABELS = {
  security: 'ความปลอดภัย & ตั้งค่าระบบ',
};

// รวม permission รายคีย์ view/edit เป็นโมดูลเดียว ต่อ 1 แถวในตาราง
function toModules(permissions) {
  const byBase = new Map();
  permissions.forEach((p) => {
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
    handheldEnabled,
    canManageSubordinates,
    permissionsLoading,
    refreshPermissions,
  } = useGetUserPermissions(open ? targetUser?.id : undefined);

  const [tab, setTab] = useState('web');
  const [permLocal, setPermLocal] = useState({});
  const [resetKeys, setResetKeys] = useState(() => new Set());
  const [handheldLocal, setHandheldLocal] = useState(true);
  const [manageLocal, setManageLocal] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || permissionsLoading) return;
    setPermLocal(Object.fromEntries(permissions.map((p) => [p.key, p.effective])));
    setResetKeys(new Set());
    setHandheldLocal(!!handheldEnabled);
    setManageLocal(!!canManageSubordinates);
    setTab('web');
  }, [open, permissionsLoading, permissions, handheldEnabled, canManageSubordinates]);

  const webGroups = useMemo(() => toModules(permissions), [permissions]);
  const permByKey = useMemo(
    () => Object.fromEntries(permissions.map((p) => [p.key, p])),
    [permissions]
  );

  const hasChanges =
    resetKeys.size > 0 ||
    permissions.some((p) => permLocal[p.key] !== p.effective) ||
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
      // 1) ธง handheld / สร้างพนักงาน -> PATCH /users/:id
      const userPatch = {};
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
    const { view } = mod.actions;
    const { edit } = mod.actions;
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
              <Tab value="web" label="สิทธิ์การเข้าถึงเมนู" />
              {(!targetIsSuperadmin || (targetIsAdmin && isSuperadminActor)) && (
                <Tab value="other" label="อื่นๆ" />
              )}
            </Tabs>

            {tab === 'web' && (
              <Stack spacing={0.5}>
                <PendingResetHint
                  permissions={permissions}
                  permLocal={permLocal}
                  permByKey={permByKey}
                  resetKeys={resetKeys}
                  onReset={resetPerm}
                />
                {renderGroups(webGroups)}
              </Stack>
            )}

            {tab === 'other' && (
              <Stack spacing={1.5}>
                {!targetIsSuperadmin && (
                  <FormControlLabel
                    control={
                      <Switch
                        checked={handheldLocal}
                        onChange={(e) => setHandheldLocal(e.target.checked)}
                      />
                    }
                    label={
                      <Typography variant="subtitle2">
                        อนุญาตให้ใช้งานเครื่องพกพา (handheld)
                      </Typography>
                    }
                  />
                )}

                {targetIsAdmin && isSuperadminActor && (
                  <>
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
                      พนักงานที่แอดมินคนนี้สร้าง จะได้สิทธิ์ไม่เกินสิทธิ์ของแอดมิน
                    </Typography>
                  </>
                )}
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
function PendingResetHint({ permissions, permLocal, permByKey, resetKeys, onReset }) {
  const overridden = permissions.filter(
    (p) =>
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
