import React, { useState, useRef } from 'react';
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInputProps,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, typography } from '../theme';
import { useTheme } from '../contexts/ThemeContext';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  helperText?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  isPassword?: boolean;
  disabled?: boolean;
}

export function Input({
  label,
  error,
  helperText,
  icon,
  isPassword,
  disabled,
  style,
  ...props
}: InputProps) {
  const { isDark, colors: tc } = useTheme();
  const [showPassword, setShowPassword] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const borderColor = error
    ? colors.error[500]
    : isFocused
    ? colors.primary[500]
    : isDark
    ? tc.neutral[200]
    : colors.neutral[200];

  const bgColor = disabled
    ? tc.neutral[100]
    : error
    ? isDark
      ? 'rgba(239,68,68,0.1)'
      : colors.error[50]
    : tc.neutral[0];

  const iconColor = error
    ? colors.error[500]
    : isFocused
    ? colors.primary[500]
    : tc.neutral[400];

  return (
    <View style={styles.container}>
      {label && (
        <Text style={[styles.label, { color: isDark ? tc.neutral[700] : colors.neutral[700] }]}>
          {label}
        </Text>
      )}
      <View
        style={[
          styles.inputContainer,
          {
            borderColor,
            backgroundColor: bgColor,
            borderLeftWidth: isFocused && !error ? 3 : 1.5,
            borderLeftColor: isFocused && !error ? colors.primary[500] : borderColor,
          },
          disabled && styles.inputDisabled,
        ]}
      >
        {icon && (
          <Ionicons name={icon} size={18} color={iconColor} style={styles.icon} />
        )}
        <TextInput
          style={[
            styles.input,
            { color: isDark ? tc.neutral[900] : colors.neutral[900] },
            style,
          ]}
          placeholderTextColor={tc.neutral[400]}
          secureTextEntry={isPassword && !showPassword}
          editable={!disabled}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          {...props}
        />
        {isPassword && (
          <TouchableOpacity
            onPress={() => setShowPassword(!showPassword)}
            style={styles.eyeBtn}
            disabled={disabled}
          >
            <Ionicons
              name={showPassword ? 'eye-off-outline' : 'eye-outline'}
              size={18}
              color={tc.neutral[400]}
            />
          </TouchableOpacity>
        )}
      </View>
      {error && (
        <View style={styles.messageContainer}>
          <Ionicons name="alert-circle" size={13} color={colors.error[500]} />
          <Text style={styles.error}>{error}</Text>
        </View>
      )}
      {helperText && !error && (
        <Text style={[styles.helperText, { color: tc.neutral[500] }]}>{helperText}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: spacing.lg },
  label: {
    ...typography.label,
    color: colors.neutral[700],
    marginBottom: spacing.xs,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.neutral[200],
    borderRadius: borderRadius.md,
    backgroundColor: colors.neutral[0],
    paddingHorizontal: spacing.md,
    minHeight: 48,
  },
  inputDisabled: {
    opacity: 0.55,
  },
  icon: { marginRight: spacing.sm },
  input: {
    flex: 1,
    ...typography.body,
    color: colors.neutral[900],
    paddingVertical: spacing.md,
  },
  eyeBtn: { padding: spacing.xs },
  messageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
    gap: spacing.xxs,
  },
  error: {
    ...typography.caption,
    color: colors.error[600],
    flex: 1,
  },
  helperText: {
    ...typography.caption,
    color: colors.neutral[500],
    marginTop: spacing.xs,
  },
});
