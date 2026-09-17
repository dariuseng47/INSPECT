'use client';

import { PDFDownloadLink } from '@react-pdf/renderer';

import NoSsr from '@mui/material/NoSsr';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';

import { Iconify } from 'src/components/iconify';

import { FabricDateRangeFilter } from './fabric-date-range-filter';

// ----------------------------------------------------------------------

// แถบตัวกรองวันที่ + ปุ่ม Export Excel/PDF — ใช้ร่วมกันทุกเมนูย่อยของ "จัดการผ้าและล็อต"
// (คลังผ้า/ล็อต/พัก-ชำรุด/จำหน่ายออก) เดิมแต่ละหน้าก็อปวาง JSX ชุดนี้แทบทั้งชิ้น
export function FabricExportToolbar({ dateFilterProps, pdfDocument, pdfFileName, onExportExcel }) {
  return (
    <Stack
      direction="row"
      spacing={1.5}
      flexWrap="wrap"
      useFlexGap
      alignItems="center"
      justifyContent="space-between"
    >
      <FabricDateRangeFilter {...dateFilterProps} />

      <Stack direction="row" spacing={1.5} alignItems="center">
        <NoSsr>
          <PDFDownloadLink document={pdfDocument} fileName={pdfFileName} style={{ textDecoration: 'none' }}>
            {({ loading }) => (
              <Button
                size="small"
                variant="contained"
                startIcon={
                  loading ? (
                    <CircularProgress size={14} color="inherit" />
                  ) : (
                    <Iconify icon="solar:file-download-bold-duotone" />
                  )
                }
                disabled={loading}
              >
                Export PDF
              </Button>
            )}
          </PDFDownloadLink>
        </NoSsr>
        <Button
          size="small"
          variant="outlined"
          color="success"
          startIcon={<Iconify icon="solar:file-text-bold-duotone" />}
          onClick={onExportExcel}
        >
          Export Excel
        </Button>
      </Stack>
    </Stack>
  );
}
