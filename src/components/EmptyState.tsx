import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius } from '../theme';
import { useTheme } from '../contexts/ThemeContext';
import { Button } from './Button';

interface EmptyStateProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  message: string;
  action?: {
    label: string;
    onPress: () => void;
    variant?: 'primary' | 'outline';
  };
  variant?: 'default' | 'compact';
}

export function EmptyState({ icon, title, message, action, variant = 'default' }: EmptyStateProps) {
  const { isDark, colors: tc } = useTheme();
  const isCompact = variant === 'compact';

  // Subtle entrance animation
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(12)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 350, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, speed: 20, bounciness: 4, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <Animated.View
      style={[
        styles.container,
        isCompact && styles.containerCompact,
        { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
      ]}
    >
      <View
        style={[
          styles.iconWrap,
          isCompact && styles.iconWrapCompact,
          {
            backgroundColor: isDark
              ? 'rgba(8,145,178,0.12)'
              : colors.primary[50],
            borderWidth: 1,
            borderColor: isDark
              ? 'rgba(8,145,178,0.25)'
              : colors.primary[100],
          },
        ]}
      >
        <Ionicons
          name={icon}
          size={isCompact ? 28 : 42}
          color={isDark ? colors.primary[400] : colors.primary[500]}
        />
      </View>
      <Text
        style={[
          styles.title,
          isCompact && styles.titleCompact,
          { color: isDark ? tc.neutral[800] : colors.neutral[800] },
        ]}
      >
        {title}
      </Text>
      <Text
        style={[
          styles.message,
          isCompact && styles.messageCompact,
          { color: isDark ? tc.neutral[500] : colors.neutral[500] },
        ]}
      >
        {message}
      </Text>
      {action && (
        <Button
          title={action.label}
          onPress={action.onPress}
          variant={action.variant || 'primary'}
          style={styles.actionButton}
        />
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.massive,
    paddingHorizontal: spacing.xl,
  },
  containerCompact: { paddingVertical: spacing.xl },
  iconWrap: {
    width: 88,
    height: 88,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  iconWrapCompact: {
    width: 60,
    height: 60,
    marginBottom: spacing.md,
  },
  title: {
    ...typography.h4,
    color: colors.neutral[800],
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  titleCompact: {
    ...typography.bodyMedium,
    marginBottom: spacing.xs,
  },
  message: {
    ...typography.body,
    color: colors.neutral[500],
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 280,
  },
  messageCompact: {
    ...typography.caption,
    lineHeight: 18,
  },
  actionButton: {
    marginTop: spacing.lg,
    minWidth: 160,
  },
});
