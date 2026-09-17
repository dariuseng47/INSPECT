// MUJI-style elevation: flat by default, shadow reserved for a couple of
// floating surfaces (bottom tab bar, action sheets). Reduced from the
// dashboard's 25-step MUI shadow scale (dashboard/src/theme/core/shadows.js)
// down to the 3 levels this app actually uses.

export const shadow = {
  none: {},
  low: {
    shadowColor: '#1C252E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  raised: {
    shadowColor: '#1C252E',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 6,
  },
};
