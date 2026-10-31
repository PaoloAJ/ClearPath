// Tokens from the ClearPath Figma prototype. Text colors are at least 4.5:1 on `background`
// and `surface`. Status colors are always paired with an icon and words (R6: never color alone).
export const colors = {
  background: '#FFFFFF',
  surface: '#F4F5F9',
  text: '#0B1A4A',
  textSecondary: '#3E4766',
  textMuted: '#5A6480',
  primary: '#0021A5',
  primaryTint: '#EEF1FB',
  primarySoft: '#CFD7F3',
  onPrimary: '#FFFFFF',
  onNavySoft: '#CFD7F3',
  // Input and checkbox outlines need 3:1 against white; `hairline` is for decoration only.
  border: '#5A6480',
  hairline: '#E4E8F3',
  report: '#D23B0D',
  pinOrange: '#C8380C',
  orangeTint: '#FDEBE4',
  statusOut: '#B3123A',
  statusOutText: '#8F0E2E',
  statusOutTint: '#FBE7EB',
  statusWorking: '#0021A5',
  statusWorkingTint: '#E3E8FA',
  statusUnconfirmed: '#3E4766',
  verified: '#0021A5',
  routeLine: '#F04E1F',
  mapGround: '#E6EAF4',
  shadow: '#0B1A4A',
};

export const fonts = {
  regular: 'Figtree_400Regular',
  semibold: 'Figtree_600SemiBold',
  bold: 'Figtree_700Bold',
  extrabold: 'Figtree_800ExtraBold',
};

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 };

export const radius = { sm: 12, md: 14, lg: 18, sheet: 20, pill: 999 };

/** Minimum tap target, in points (R6). */
export const MIN_TAP_TARGET = 48;
