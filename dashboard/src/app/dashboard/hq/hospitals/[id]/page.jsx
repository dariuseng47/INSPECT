'use client';

import { useParams } from 'next/navigation';

import { DashboardContent } from 'src/layouts/dashboard';

import { HospitalDetailView } from 'src/sections/hq/view';

// ----------------------------------------------------------------------

export default function Page() {
  const params = useParams();
  const hospitalId = Number(params.id);

  return (
    <DashboardContent maxWidth="xl">
      <HospitalDetailView hospitalId={hospitalId} />
    </DashboardContent>
  );
}
