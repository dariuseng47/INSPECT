'use client';

import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Divider from '@mui/material/Divider';
import Accordion from '@mui/material/Accordion';
import Typography from '@mui/material/Typography';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';

import { DashboardContent } from 'src/layouts/dashboard';

import { Iconify } from 'src/components/iconify';
import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';

import { SITE_MAP, ROLE_LABEL } from '../site-map-data';

// ----------------------------------------------------------------------

function RoleChips({ roles }) {
  const allRoles = ['SUPERADMIN', 'ADMIN', 'OPERATOR'];
  const isAllRoles = allRoles.every((role) => roles.includes(role));

  if (isAllRoles) {
    return <Chip size="small" variant="soft" color="success" label="ทุก role เห็นเมนูนี้" />;
  }

  return (
    <Stack direction="row" spacing={0.5}>
      {roles.map((role) => (
        <Chip key={role} size="small" variant="soft" label={ROLE_LABEL[role]} />
      ))}
    </Stack>
  );
}

function ChildRow({ item }) {
  return (
    <Stack direction="row" spacing={2} sx={{ py: 1.5 }}>
      <Iconify icon={item.icon} width={22} sx={{ mt: 0.25, color: 'text.secondary', flexShrink: 0 }} />
      <Stack spacing={0.25}>
        <Typography variant="subtitle2">{item.title}</Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          {item.description}
        </Typography>
      </Stack>
    </Stack>
  );
}

export function SiteMapView() {
  return (
    <DashboardContent maxWidth="lg">
      <CustomBreadcrumbs
        heading="แผนผังเว็บไซต์"
        links={[{ name: 'ข้อมูลระบบ' }, { name: 'แผนผังเว็บไซต์' }]}
        sx={{ mb: { xs: 3, md: 5 } }}
      />

      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 4 }}>
        รวมทุกเมนูในระบบพร้อมคำอธิบายว่าแต่ละส่วนใช้ทำอะไรและทำงานอย่างไร — คลิกแต่ละหัวข้อเพื่อดูรายละเอียด
        เมนูที่คุณเห็นจริงในแถบซ้ายมืออาจน้อยกว่านี้ ขึ้นอยู่กับสิทธิ์ (role) ของบัญชีคุณ
      </Typography>

      <Stack spacing={2}>
        {SITE_MAP.map((section) => (
          <Accordion key={section.title} defaultExpanded={false}>
            <AccordionSummary expandIcon={<Iconify icon="eva:arrow-ios-downward-fill" />}>
              <Stack
                direction="row"
                alignItems="center"
                spacing={2}
                sx={{ width: 1, pr: 2 }}
                flexWrap="wrap"
              >
                <Iconify icon={section.icon} width={28} sx={{ color: 'primary.main' }} />
                <Typography variant="h6" sx={{ flexGrow: 1 }}>
                  {section.title}
                </Typography>
                <RoleChips roles={section.roles} />
              </Stack>
            </AccordionSummary>

            <AccordionDetails sx={{ pt: 0 }}>
              <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>
                {section.description}
              </Typography>

              {section.children.length > 0 && (
                <>
                  <Divider sx={{ my: 1 }} />
                  <Stack divider={<Divider />}>
                    {section.children.map((child) => (
                      <ChildRow key={child.title} item={child} />
                    ))}
                  </Stack>
                </>
              )}
            </AccordionDetails>
          </Accordion>
        ))}
      </Stack>
    </DashboardContent>
  );
}
