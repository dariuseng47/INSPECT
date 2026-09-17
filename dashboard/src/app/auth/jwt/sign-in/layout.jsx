import { AuthSplitLayout } from 'src/layouts/auth-split';

import { GuestGuard } from 'src/auth/guard';

// ----------------------------------------------------------------------

export default function Layout({ children }) {
  return (
    <GuestGuard>
      <AuthSplitLayout
        header={{ sx: { display: 'none' } }}
        section={{
          title: 'ระบบบริหารจัดการผ้า',
          subtitle:
            'ติดตามและบริหารผ้าในเครือข่ายโรงพยาบาลของคุณแบบเรียลไทม์ ทุกขั้นตอนตั้งแต่ซักจนถึงตู้แผนก',
          imgUrl: '/assets/illustrations/illustration-login-laundry.png',
        }}
      >
        {children}
      </AuthSplitLayout>
    </GuestGuard>
  );
}
