import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../../components';
import { colors, spacing, typography } from '../../theme';
import { useTheme } from '../../contexts/ThemeContext';

export function PendingApprovalScreen() {

  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors, isDark), [colors, isDark]);
  const { signOut, refreshProfile } = useAuth();

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.iconWrap}>
          <Ionicons name="time-outline" size={56} color={colors.warning[500]} />
        </View>
        <Text style={styles.title}>Pending Approval</Text>
        <Text style={styles.message}>
          Your account is awaiting admin approval. You will be notified once your account has been
          activated.
        </Text>
        <Button title="Check Status" onPress={refreshProfile} variant="outline" />
        <Button
          title="Sign Out"
          onPress={signOut}
          variant="ghost"
          style={{ marginTop: spacing.sm }}
        />
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
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  iconWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.warning[50],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    ...typography.h2,
    color: colors.neutral[900],
    marginBottom: spacing.sm,
  },
  message: {
    ...typography.body,
    color: colors.neutral[500],
    textAlign: 'center',
    marginBottom: spacing.lg,
    lineHeight: 22,
  },
  powered: {
    ...typography.small,
    color: colors.neutral[400],
    textAlign: 'center',
    marginTop: spacing.lg,
  },
});
