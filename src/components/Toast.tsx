import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius } from '../theme';

type ToastType = 'success' | 'error' | 'info';

interface ToastProps {
  message: string;
  type?: ToastType;
  visible: boolean;
  onHide: () => void;
  duration?: number;
}

export function Toast({
  message,
  type = 'success',
  visible,
  onHide,
  duration = 2000,
}: ToastProps) {
  const translateY = useRef(new Animated.Value(-120)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          speed: 20,
          bounciness: 6,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();

      const timer = setTimeout(hideToast, duration);
      return () => clearTimeout(timer);
    }
  }, [visible]);

  const hideToast = () => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -120,
        duration: 280,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => onHide());
  };

  if (!visible) return null;

  const config = {
    success: {
      bg: '#0F172A',
      accent: colors.success[400],
      icon: 'checkmark-circle' as const,
      text: '#F1F5F9',
    },
    error: {
      bg: '#0F172A',
      accent: colors.error[400],
      icon: 'close-circle' as const,
      text: '#F1F5F9',
    },
    info: {
      bg: '#0F172A',
      accent: colors.primary[400],
      icon: 'information-circle' as const,
      text: '#F1F5F9',
    },
  }[type];

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ translateY }],
          opacity,
          backgroundColor: config.bg,
        },
      ]}
    >
      {/* Colored left accent bar */}
      <View style={[styles.accentBar, { backgroundColor: config.accent }]} />
      <View style={styles.content}>
        <Ionicons name={config.icon} size={20} color={config.accent} style={styles.icon} />
        <Text style={[styles.message, { color: config.text }]} numberOfLines={2}>
          {message}
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 56 : 48,
    left: spacing.lg,
    right: spacing.lg,
    zIndex: 9999,
    borderRadius: borderRadius.lg,
    flexDirection: 'row',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 12,
  },
  accentBar: {
    width: 4,
    borderTopLeftRadius: borderRadius.lg,
    borderBottomLeftRadius: borderRadius.lg,
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  icon: {
    flexShrink: 0,
  },
  message: {
    ...typography.bodyMedium,
    fontSize: 14,
    flex: 1,
  },
});
