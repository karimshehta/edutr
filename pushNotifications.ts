import React, { useRef } from 'react';
import {
  View,
  StyleSheet,
  StyleProp,
  ViewStyle,
  Animated,
  Pressable,
} from 'react-native';
import { colors, spacing, borderRadius } from '../theme';
import { useTheme } from '../contexts/ThemeContext';

interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  variant?: 'elevated' | 'outlined' | 'filled';
  padding?: keyof typeof spacing;
  elevationLevel?: 'none' | 'sm' | 'md' | 'lg';
}

export function Card({
  children,
  style,
  onPress,
  variant = 'elevated',
  padding = 'lg',
  elevationLevel = 'md',
}: CardProps) {
  const { isDark, colors: tc } = useTheme();
  const scale = useRef(new Animated.Value(1)).current;

  const shadowStyles = {
    none: {},
    sm: {
      shadowColor: isDark ? '#000' : '#64748B',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: isDark ? 0.4 : 0.06,
      shadowRadius: 3,
      elevation: 1,
    },
    md: {
      shadowColor: isDark ? '#000' : '#475569',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: isDark ? 0.5 : 0.08,
      shadowRadius: 6,
      elevation: 3,
    },
    lg: {
      shadowColor: isDark ? '#000' : '#334155',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: isDark ? 0.6 : 0.1,
      shadowRadius: 12,
      elevation: 6,
    },
  };

  const bgColor =
    variant === 'filled'
      ? tc.neutral[100]
      : tc.neutral[0];

  const borderColor = isDark ? tc.neutral[200] : colors.neutral[200];

  const cardStyle: StyleProp<ViewStyle> = [
    styles.base,
    { backgroundColor: bgColor, padding: spacing[padding] },
    variant === 'elevated' && shadowStyles[elevationLevel],
    variant === 'outlined' && { borderWidth: 1, borderColor },
    variant === 'filled' && { borderWidth: 0 },
    style,
  ];

  const onPressIn = () => {
    Animated.spring(scale, {
      toValue: 0.98,
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
      bounciness: 3,
    }).start();
  };

  if (onPress) {
    return (
      <Animated.View style={{ transform: [{ scale }] }}>
        <Pressable
          onPress={onPress}
          onPressIn={onPressIn}
          onPressOut={onPressOut}
          style={cardStyle}
        >
          {children}
        </Pressable>
      </Animated.View>
    );
  }

  return <View style={cardStyle}>{children}</View>;
}

const styles = StyleSheet.create({
  base: {
    borderRadius: borderRadius.lg,
    backgroundColor: colors.neutral[0],
  },
});
