// ─── Light theme (default) ────────────────────────────────────────────────────
export const colors = {
  primary: {
    50: '#ECFEFF', 100: '#CFFAFE', 200: '#A5F3FC', 300: '#67E8F9',
    400: '#22D3EE', 500: '#06B6D4', 600: '#0891B2', 700: '#0E7490',
    800: '#155E75', 900: '#164E63',
  },
  secondary: {
    50: '#EFF6FF', 100: '#DBEAFE', 200: '#BFDBFE', 300: '#93C5FD',
    400: '#60A5FA', 500: '#3B82F6', 600: '#2563EB', 700: '#1D4ED8',
    800: '#1E40AF', 900: '#1E3A8A',
  },
  accent: {
    50: '#FFFBEB', 100: '#FEF3C7', 200: '#FDE68A', 300: '#FCD34D',
    400: '#FBBF24', 500: '#F59E0B', 600: '#D97706', 700: '#B45309',
    800: '#92400E', 900: '#78350F',
  },
  success: {
    50: '#ECFDF5', 100: '#D1FAE5', 200: '#A7F3D0', 300: '#6EE7B7',
    400: '#34D399', 500: '#10B981', 600: '#059669', 700: '#047857',
    800: '#065F46', 900: '#064E3B',
  },
  warning: {
    50: '#FFFBEB', 100: '#FEF3C7', 200: '#FDE68A', 300: '#FCD34D',
    400: '#FBBF24', 500: '#F59E0B', 600: '#D97706', 700: '#B45309',
    800: '#92400E', 900: '#78350F',
  },
  error: {
    50: '#FEF2F2', 100: '#FEE2E2', 200: '#FECACA', 300: '#FCA5A5',
    400: '#F87171', 500: '#EF4444', 600: '#DC2626', 700: '#B91C1C',
    800: '#991B1B', 900: '#7F1D1D',
  },
  neutral: {
    0: '#FFFFFF',
    50: '#F8FAFC', 100: '#F1F5F9', 200: '#E2E8F0',
    300: '#CBD5E1', 400: '#94A3B8', 500: '#64748B', 600: '#475569',
    700: '#334155', 800: '#1E293B', 900: '#0F172A', 950: '#020617',
  },
  info: {
    50: '#EFF6FF', 100: '#DBEAFE', 200: '#BFDBFE', 300: '#93C5FD',
    400: '#60A5FA', 500: '#3B82F6', 600: '#2563EB', 700: '#1D4ED8',
    800: '#1E40AF', 900: '#1E3A8A',
  },
};

// ─── Dark theme ───────────────────────────────────────────────────────────────
// Re-uses the same brand palette but remaps the neutral scale so that surfaces
// and text invert correctly. All semantic colors (primary, success, error …)
// keep the same hues but their 50/100 tint variants are replaced with deeper
// equivalents so they still read as tinted backgrounds on a dark surface.
export const darkColors = {
  primary:   colors.primary,
  secondary: colors.secondary,
  accent:    colors.accent,
  success:   colors.success,
  warning:   colors.warning,
  error:     colors.error,
  info:      colors.info,
  // Neutral scale fully inverted for dark surfaces
  neutral: {
    0:   '#1E293B',   // card surface       (was #FFFFFF)
    50:  '#0F172A',   // page background    (was #F8FAFC)
    100: '#1E293B',   // subtle surface     (was #F1F5F9)
    200: '#334155',   // border             (was #E2E8F0)
    300: '#475569',   // strong border      (was #CBD5E1)
    400: '#64748B',   // muted text         (was #94A3B8)
    500: '#94A3B8',   // secondary text     (was #64748B)
    600: '#CBD5E1',   // primary text       (was #475569)
    700: '#E2E8F0',   // strong text        (was #334155)
    800: '#F1F5F9',   // heading text       (was #1E293B)
    900: '#F8FAFC',   // max contrast text  (was #0F172A)
    950: '#FFFFFF',   // pure white on dark (was #020617)
  },
};

export type ColorScale = typeof colors;
