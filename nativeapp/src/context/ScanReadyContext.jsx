import { createContext, useContext, useMemo, useState } from 'react';

// สถานะ "พร้อมสแกน" ระดับแอป — ScannerInput ทุกจุด (ward.jsx, inventory/index.jsx ฯลฯ) publish
// สถานะช่องว่าง/ไม่ว่างของตัวเองมาที่นี่ แทนที่จะโชว์ badge ติดอยู่กับช่องกรอกเอง เพื่อให้
// app/(app)/_layout.jsx เอาไปโชว์เป็นไอคอนกะพริบลอยเหนือปุ่มหน้าแรกใน tab bar แทน — จุดเดียว
// เห็นชัดตลอดไม่ว่าจะอยู่หน้าไหน
const ScanReadyContext = createContext({ scanReady: false, setScanReady: () => {} });

export function ScanReadyProvider({ children }) {
  const [scanReady, setScanReady] = useState(false);
  const value = useMemo(() => ({ scanReady, setScanReady }), [scanReady]);
  return <ScanReadyContext.Provider value={value}>{children}</ScanReadyContext.Provider>;
}

export function useScanReady() {
  return useContext(ScanReadyContext);
}
