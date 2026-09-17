'use client';

import { useState } from 'react';

import Card from '@mui/material/Card';
import Table from '@mui/material/Table';
import Button from '@mui/material/Button';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import Typography from '@mui/material/Typography';
import CardHeader from '@mui/material/CardHeader';
import IconButton from '@mui/material/IconButton';
import CardContent from '@mui/material/CardContent';
import TableContainer from '@mui/material/TableContainer';

import { useBoolean } from 'src/hooks/use-boolean';

import { Iconify } from 'src/components/iconify';
import { Scrollbar } from 'src/components/scrollbar';
import { EmptyContent } from 'src/components/empty-content';
import { LoadingScreen } from 'src/components/loading-screen';

import { CategoryFormDialog } from './category-form-dialog';

// ----------------------------------------------------------------------

// จัดการหมวดหมู่ผ้า — โชว์ลิสต์ที่มีอยู่แล้วทั้งหมด กดแก้ไขรายการเดิมได้เลย (เดิมมีแค่ dialog
// สร้างใหม่ ไม่มีที่ดู/แก้รายการเก่า)
export function CategoryManagerCard({ hospitalId, categories, categoriesLoading, onChanged }) {
  const formDialog = useBoolean();
  const [formMode, setFormMode] = useState('create');
  const [activeCategory, setActiveCategory] = useState(null);

  const openCreate = () => {
    setFormMode('create');
    setActiveCategory(null);
    formDialog.onTrue();
  };

  const openEdit = (category) => {
    setFormMode('edit');
    setActiveCategory(category);
    formDialog.onTrue();
  };

  return (
    <Card>
      <CardHeader
        title="หมวดหมู่ผ้า"
        subheader="รายการหมวดหมู่ผ้าทั้งหมดของโรงพยาบาลนี้ — กดที่แถวเพื่อแก้ไข"
        action={
          <Button
            variant="contained"
            startIcon={<Iconify icon="mingcute:add-line" />}
            onClick={openCreate}
            disabled={!hospitalId}
          >
            เพิ่มหมวดหมู่
          </Button>
        }
      />
      <CardContent>
        {!hospitalId ? (
          <EmptyContent title="กรุณาเลือกโรงพยาบาลก่อน" sx={{ py: 8 }} />
        ) : categoriesLoading ? (
          <LoadingScreen sx={{ height: 160 }} />
        ) : categories.length === 0 ? (
          <EmptyContent
            title="ยังไม่มีหมวดหมู่ผ้า"
            description="เริ่มต้นด้วยการเพิ่มหมวดหมู่แรก เช่น ผ้าปูเตียง, เสื้อผู้ป่วย"
            sx={{ py: 8 }}
          />
        ) : (
          <Scrollbar>
            <TableContainer sx={{ minWidth: 480 }}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>ชื่อหมวดหมู่</TableCell>
                    <TableCell align="right">การจัดการ</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {categories.map((category) => (
                    <TableRow
                      key={category.id}
                      hover
                      onClick={() => openEdit(category)}
                      sx={{ cursor: 'pointer' }}
                    >
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {category.name}
                        </Typography>
                        {category.description && (
                          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                            {category.description}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell align="right">
                        <IconButton
                          onClick={(event) => {
                            event.stopPropagation();
                            openEdit(category);
                          }}
                        >
                          <Iconify icon="solar:pen-2-bold-duotone" width={18} />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Scrollbar>
        )}
      </CardContent>

      <CategoryFormDialog
        open={formDialog.value}
        onClose={formDialog.onFalse}
        mode={formMode}
        category={activeCategory}
        hospitalId={hospitalId}
        onSaved={onChanged}
      />
    </Card>
  );
}
