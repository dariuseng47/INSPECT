// Operator-facing subset of dashboard/src/layouts/config-nav-dashboard.jsx —
// items gated to SUPERADMIN/ADMIN only (org tree, devices, security/users) are
// excluded. Icon names are MaterialCommunityIcons (via @expo/vector-icons),
// chosen as the closest practical match to the dashboard's Iconify `solar:*`
// duotone set — React Native has no Iconify runtime.
//
// Each tab has an outline icon (inactive) and a filled icon (active) — the tab bar
// swaps between them so the active tab reads as "on" rather than just tinted.

// ลำดับนี้คือลำดับที่โชว์บน tab bar จริง — home อยู่ตรงกลาง ตั้งใจให้เป็นปุ่มวงกลมใหญ่เด่นกว่าอันอื่น
// (ดู app/(app)/_layout.jsx ที่ render แยกเคสสำหรับ tab ชื่อ "home")
//
// "พัก & ชำรุด" กับ "ค้นหาตำแหน่ง" เอาออกจากเมนู/tab bar แล้ว (หน้าจอ hold.jsx/location.jsx ยังอยู่
// เข้าถึงได้ผ่าน router.push ตรงๆ แค่ไม่มีปุ่มเข้าเมนูให้แล้ว) — ดู _layout.jsx ที่ยังต้อง render
// Tabs.Screen แบบ href: null ให้สองอันนี้ ไม่งั้น Expo Router จะ auto-append เป็นแท็บเพิ่มเอง
// perm = คีย์ handheld.<module>.view ที่ต้อง effective ถึงจะเห็นแท็บ (undefined = เห็นเสมอ)
export const tabs = [
  {
    name: 'inventory',
    label: 'คลังผ้า',
    icon: 'archive-outline',
    iconActive: 'archive',
    perm: 'handheld.inventory.view',
  },
  {
    name: 'home',
    label: 'หน้าแรก',
    icon: 'home-outline',
    iconActive: 'home',
  },
  {
    name: 'ward',
    label: 'รับ-ส่งวอร์ด',
    icon: 'truck-delivery-outline',
    iconActive: 'truck-delivery',
    perm: 'handheld.ward.view',
  },
];
