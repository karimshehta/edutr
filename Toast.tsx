import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, borderRadius, typography, spacing } from '../theme';
import { useTheme } from '../contexts/ThemeContext';

type BadgeVariant = 'success' | 'warning' | 'error' | 'info' | 'neutral' | 'primary';
type BadgeSize = 'sm' | 'md' | 'lg';

interface BadgeProps {
  text: string;
  variant?: BadgeVariant;
  size?: BadgeSize;
  icon?: keyof typeof Ionicons.glyphMap;
  style?: ViewStyle;
  dot?: boolean;
}

const variantColors: Record<BadgeVariant, { bg: string; text: string; border: string }> = {
  primary: { bg: colors.primary[50],  text: colors.primary[700],  border: colors.primary[200]  },
  success: { bg: colors.success[50],  text: colors.success[700],  border: colors.success[200]  },
  warning: { bg: colors.warning[50],  text: colors.warning[700],  border: colors.warning[200]  },
  error:   { bg: colors.error[50],    text: colors.error[700],    border: colors.error[200]    },
  info:    { bg: colors.info[50],     text: colors.info[700],     border: colors.info[200]     },
  neutral: { bg: colors.neutral[100], text: colors.neutral[600],  border: colors.neutral[200]  },
};

// Dark-mode overrides — tinted but visible on dark surfaces
const darkVariantColors: Record<BadgeVariant, { bg: string; text: string; border: string }> = {
  primary: { bg: 'rgba(8,145,178,0.18)',  text: colors.primary[300],  border: 'rgba(8,145,178,0.35)'  },
  success: { bg: 'rgba(16,185,129,0.18)', text: colors.success[300],  border: 'rgba(16,185,129,0.35)' },
  warning: { bg: 'rgba(245,158,11,0.18)', text: colors.warning[300],  border: 'rgba(245,158,11,0.35)' },
  error:   { bg: 'rgba(239,68,68,0.18)',  text: colors.error[300],    border: 'rgba(239,68,68,0.35)'  },
  info:    { bg: 'rgba(59,130,246,0.18)', text: colors.info[300],     border: 'rgba(59,130,246,0.35)' },
  neutral: { bg: 'rgba(100,116,139,0.2)', text: '#CBD5E1',            border: 'rgba(100,116,139,0.3)' },
};

const sizeStyles = {
  sm: { paddingHorizontal: 6,  paddingVertical: 2, iconSize: 10, dotSize: 4 },
  md: { paddingHorizontal: 8,  paddingVertical: 3, iconSize: 12, dotSize: 5 },
  lg: { paddingHorizontal: 12, paddingVertical: 5, iconSize: 14, dotSize: 6 },
};

export function Badge({ text, variant = 'neutral', size = 'md', icon, dot, style }: BadgeProps) {
  const { isDark } = useTheme();
  const c = isDark ? darkVariantColors[variant] : variantColors[variant];
  const s = sizeStyles[size];

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: c.bg,
          borderColor: c.border,
          paddingHorizontal: s.paddingHorizontal,
          paddingVertical: s.paddingVertical,
        },
        style,
      ]}
    >
      {dot && (
        <View
          style={[
            styles.dot,
            { width: s.dotSize, height: s.dotSize, backgroundColor: c.text },
          ]}
        />
      )}
      {icon && (
        <Ionicons name={icon} size={s.iconSize} color={c.text} style={styles.icon} />
      )}
      <Text
        style={[
          size === 'sm' ? typography.tiny : typography.caption,
          styles.text,
          { color: c.text },
        ]}
      >
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: borderRadius.full,
    alignSelf: 'flex-start',
    borderWidth: 1,
  },
  text: { fontWeight: '600', letterSpacing: 0.1 },
  icon: { marginRight: spacing.xxs },
  dot:  { borderRadius: borderRadius.full, marginRight: spacing.xxs },
});
