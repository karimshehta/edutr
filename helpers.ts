import React, { useRef } from 'react';
import {
  Animated,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
  View,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, typography, elevation } from '../theme';
import { useTheme } from '../contexts/ThemeContext';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost' | 'success';
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  size?: 'sm' | 'md' | 'lg';
  icon?: keyof typeof Ionicons.glyphMap;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  style,
  textStyle,
  size = 'md',
  icon,
  iconPosition = 'left',
  fullWidth = false,
}: ButtonProps) {
  const { isDark } = useTheme();
  const scale = useRef(new Animated.Value(1)).current;
  const isDisabled = disabled || loading;

  const onPressIn = () => {
    Animated.spring(scale, {
      toValue: 0.96,
      useNativeDriver: true,
      speed: 50,
      bounciness: 0,
    }).start();
  };

  const onPressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 30,
      bounciness: 4,
    }).start();
  };

  const getIconColor = () => {
    if (variant === 'outline') return isDark ? colors.primary[400] : colors.primary[600];
    if (variant === 'ghost') return isDark ? colors.primary[400] : colors.primary[600];
    return '#FFFFFF';
  };

  const getIconSize = () => {
    if (size === 'sm') return 16;
    if (size === 'lg') return 22;
    return 18;
  };

  // Outline border color adapts to dark mode
  const outlineBorderColor = isDark ? colors.primary[400] : colors.primary[600];
  const outlineTextColor = isDark ? colors.primary[400] : colors.primary[700];
  const ghostTextColor = isDark ? colors.primary[400] : colors.primary[700];

  return (
    <Animated.View style={{ transform: [{ scale }], ...(fullWidth ? { width: '100%' } : {}) }}>
      <Pressable
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        disabled={isDisabled}
        style={[
          styles.base,
          styles[variant],
          styles[size],
          fullWidth && styles.fullWidth,
          variant === 'primary' && !isDisabled && elevation.sm,
          isDisabled && styles.disabled,
          variant === 'outline' && { borderColor: outlineBorderColor },
          style,
        ]}
      >
        {loading ? (
          <ActivityIndicator
            color={variant === 'outline' || variant === 'ghost' ? colors.primary[500] : '#fff'}
            size="small"
          />
        ) : (
          <View style={styles.content}>
            {icon && iconPosition === 'left' && (
              <Ionicons name={icon} size={getIconSize()} color={getIconColor()} style={styles.iconLeft} />
            )}
            <Text
              style={[
                styles.text,
                styles[`${variant}Text` as keyof typeof styles] as TextStyle,
                styles[`${size}Text` as keyof typeof styles] as TextStyle,
                variant === 'outline' && { color: outlineTextColor },
                variant === 'ghost' && { color: ghostTextColor },
                textStyle,
              ]}
            >
              {title}
            </Text>
            {icon && iconPosition === 'right' && (
              <Ionicons name={icon} size={getIconSize()} color={getIconColor()} style={styles.iconRight} />
            )}
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.md,
    flexDirection: 'row',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullWidth: { width: '100%' },

  // Sizes
  md: { paddingVertical: 11, paddingHorizontal: spacing.lg, minHeight: 42 },
  sm: { paddingVertical: 8,  paddingHorizontal: spacing.md, minHeight: 34 },
  lg: { paddingVertical: 14, paddingHorizontal: spacing.xl, minHeight: 48 },

  // Variants
  primary:   { backgroundColor: colors.primary[600] },
  secondary: { backgroundColor: colors.secondary[600] },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: colors.primary[600],
  },
  danger:  { backgroundColor: colors.error[600] },
  success: { backgroundColor: colors.success[600] },
  ghost:   { backgroundColor: 'transparent' },
  disabled: { opacity: 0.45 },

  // Text
  text:          { ...typography.button, color: '#FFFFFF' },
  primaryText:   { color: '#FFFFFF' },
  secondaryText: { color: '#FFFFFF' },
  outlineText:   { color: colors.primary[700] },
  dangerText:    { color: '#FFFFFF' },
  successText:   { color: '#FFFFFF' },
  ghostText:     { color: colors.primary[700] },

  // Size-specific text
  smText: { ...typography.buttonSmall },
  mdText: { ...typography.button },
  lgText: { ...typography.button, fontSize: 17 },

  // Icon spacing
  iconLeft:  { marginRight: spacing.xs },
  iconRight: { marginLeft: spacing.xs },
});
