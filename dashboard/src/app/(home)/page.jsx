import { RootGuard } from 'src/auth/guard';

// ----------------------------------------------------------------------

export const metadata = {
  title: 'เข้าสู่ระบบ',
};

export default function Page() {
  return <RootGuard />;
}
