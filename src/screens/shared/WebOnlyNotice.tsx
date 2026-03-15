import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { colors, spacing, typography } from '../../theme';
import { useTheme } from '../../contexts/ThemeContext';

export function WebOnlyNotice() {

  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors, isDark), [colors, isDark]);
  const { signOut } = useAuth();

  const openWebsite = () => {
    Linking.openURL('https://omrex.org');
  };

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: signOut },
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.iconWrap}>
          <Ionicons name="desktop-outline" size={52} color={colors.primary[500]} />
        </View>

        <Text style={styles.title}>Web Platform Required</Text>

        <Text style={styles.message}>
          Some advanced features are only available on the OMREX web platform and require the full desktop experience.
        </Text>

        <Text style={styles.submessage}>
          The mobile app is designed for professors and students to manage their day-to-day academic workflows on the go.
        </Text>

        {/* Primary: Open Web */}
        <TouchableOpacity style={styles.primaryBtn} onPress={openWebsite} activeOpacity={0.8}>
          <Ionicons name="globe-outline" size={20} color="#fff" />
          <Text style={styles.primaryBtnText}>Open Web Platform</Text>
        </TouchableOpacity>

        {/* Secondary: Sign Out */}
        <TouchableOpacity style={styles.secondaryBtn} onPress={handleSignOut} activeOpacity={0.8}>
          <Ionicons name="log-out-outline" size={18} color={colors.neutral[600]} />
          <Text style={styles.secondaryBtnText}>Sign Out</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.powered}>Powered by OMREX</Text>
    </View>
  );
}

const makeStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral[50],
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    backgroundColor: colors.neutral[0],
    borderRadius: 20,
    padding: spacing.xl,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  iconWrap: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    ...typography.h2,
    color: colors.neutral[900],
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  message: {
    ...typography.body,
    color: colors.neutral[600],
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.xs,
  },
  submessage: {
    ...typography.caption,
    color: colors.neutral[400],
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: spacing.xl,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary[500],
    paddingVertical: 13,
    borderRadius: 12,
    gap: spacing.sm,
    width: '100%',
    marginBottom: spacing.sm,
  },
  primaryBtnText: {
    ...typography.button,
    color: '#fff',
    fontSize: 15,
  },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    gap: spacing.sm,
    width: '100%',
    borderWidth: 1.5,
    borderColor: colors.neutral[200],
    backgroundColor: colors.neutral[0],
  },
  secondaryBtnText: {
    ...typography.button,
    color: colors.neutral[600],
    fontSize: 15,
  },
  powered: {
    ...typography.small,
    color: colors.neutral[400],
    textAlign: 'center',
    marginTop: spacing.lg,
  },
});
