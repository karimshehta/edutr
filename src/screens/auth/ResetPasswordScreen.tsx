import React, { useState, useMemo} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../contexts/ToastContext';
import { Button, Input } from '../../components';
import { colors, spacing, typography } from '../../theme';
import { useTheme } from '../../contexts/ThemeContext';

// ─── Why validateSession was removed ─────────────────────────────────────────
// The previous version ran supabase.auth.getSession() on mount to verify the
// session. But because the session is set BEFORE navigating to this screen
// (in RootNavigator.handleDeepLink), the session is guaranteed to exist when
// we arrive. Running validateSession() created a race condition: the screen
// mounted, found no session (setSession hadn't resolved yet), showed the
// "Reset Link Expired" error, and left users stranded with a broken
// navigation.navigate('ForgotPassword') call that silently failed because
// ForgotPassword didn't exist in the old RecoveryStack.
//
// The correct mental model: this screen is a form. If the user landed here,
// the token is valid. Trust the app-level routing in RootNavigator.

type Props = { navigation: NativeStackNavigationProp<any> };

export function ResetPasswordScreen({ navigation }: Props) {

  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors, isDark), [colors, isDark]);
  const { showToast } = useToast();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleResetPassword = async () => {
    if (!password.trim() || !confirmPassword.trim()) {
      setError('Please fill in all fields.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      setLoading(false);

      if (updateError) {
        setError(updateError.message);
        return;
      }

      // Show success, sign out the recovery session, then go back to Main.
      // MainScreen will show AuthStack (Login) since there's no session.
      showToast(
        'Password reset successfully! Sign in with your new password.',
        'success',
        4000,
      );
      await supabase.auth.signOut();

      // navigation.goBack() returns to the "Main" screen in RootStack, which
      // now shows the Login screen (session was cleared by signOut above).
      navigation.goBack();
    } catch (err: any) {
      setLoading(false);
      setError(err?.message ?? 'Failed to reset password. Please try again.');
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.container}>
          {/* Back / cancel */}
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation.goBack()}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="arrow-back" size={22} color={colors.neutral[700]} />
          </TouchableOpacity>

          {/* Icon */}
          <View style={styles.iconWrap}>
            <Ionicons name="lock-closed-outline" size={44} color={colors.primary[500]} />
          </View>

          <Text style={styles.title}>Create New Password</Text>
          <Text style={styles.subtitle}>
            Enter a strong password to secure your account.
          </Text>

          <Input
            label="New Password"
            icon="lock-closed-outline"
            placeholder="Enter new password"
            value={password}
            onChangeText={(t) => { setPassword(t); setError(''); }}
            isPassword
            helperText="Minimum 6 characters"
          />

          <Input
            label="Confirm Password"
            icon="lock-closed-outline"
            placeholder="Confirm your password"
            value={confirmPassword}
            onChangeText={(t) => { setConfirmPassword(t); setError(''); }}
            isPassword
          />

          {error ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle-outline" size={16} color={colors.error[600]} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <Button
            title="Reset Password"
            onPress={handleResetPassword}
            loading={loading}
            style={styles.submitBtn}
          />

          <TouchableOpacity
            style={styles.cancelRow}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.cancelText}>Cancel — back to login</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.neutral[50] },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: spacing.lg },
  container: {
    backgroundColor: colors.neutral[0],
    borderRadius: 20,
    padding: spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 10,
    elevation: 3,
  },
  backBtn: {
    marginBottom: spacing.md,
    alignSelf: 'flex-start',
  },
  iconWrap: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  title: {
    ...typography.h2,
    color: colors.neutral[900],
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.body,
    color: colors.neutral[500],
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.error[50],
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.error[100],
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  errorText: {
    ...typography.caption,
    color: colors.error[700],
    flex: 1,
  },
  submitBtn: { marginTop: spacing.sm },
  cancelRow: {
    marginTop: spacing.lg,
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  cancelText: {
    ...typography.body,
    color: colors.neutral[500],
  },
});
