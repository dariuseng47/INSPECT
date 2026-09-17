export const fallbackLng = 'th';
export const languages = ['th'];
export const defaultNS = 'common';
export const cookieName = 'i18next';

// ----------------------------------------------------------------------

export function i18nOptions(lng = fallbackLng, ns = defaultNS) {
  return {
    // debug: true,
    lng,
    fallbackLng,
    ns,
    defaultNS,
    fallbackNS: defaultNS,
    supportedLngs: languages,
  };
}

// ----------------------------------------------------------------------

export const changeLangMessages = {
  th: {
    success: 'เปลี่ยนภาษาเรียบร้อยแล้ว',
    error: 'เกิดข้อผิดพลาดในการเปลี่ยนภาษา',
    loading: 'กำลังโหลด...',
  },
};
