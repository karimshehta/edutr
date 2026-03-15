import React, { useState, useMemo} from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { Button, Input } from '../../components';
import { colors, spacing, typography } from '../../theme';
import { useTheme } from '../../contexts/ThemeContext';

type Props = {
  navigation: NativeStackNavigationProp<any>;
};

export function ForgotPasswordScreen({ navigation }: Props) {

  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors, isDark), [colors, isDark]);
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleReset = async () => {
    if (!email.trim()) {
      setError('Please enter your email.');
      return;
    }
    setError('');
    setLoading(true);
    const { error: err } = await resetPassword(email.trim());
    setLoading(false);
    if (err) {
      setError(err);
    } else {
      setSent(true);
    }
  };

  if (sent) {
    return (
      <View style={styles.container}>
        <View style={styles.content}>
          <View style={styles.iconWrap}>
            <Ionicons name="mail-open-outline" size={48} color={colors.success[500]} />
          </View>
          <Text style={styles.title}>Check Your Email</Text>
          <Text style={styles.message}>
            We sent a password reset link to {email}.{'\n\n'}
            Tap the link in your email to reset your password.
          </Text>
          <Button
            title="Back to Login"
            onPress={() => navigation.goBack()}
            style={{ marginTop: spacing.lg }}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.neutral[700]} />
        </TouchableOpacity>

        <View style={styles.iconWrap}>
          <Ionicons name="key-outline" size={48} color={colors.primary[500]} />
        </View>
        <Text style={styles.title}>Reset Password</Text>
        <Text style={styles.message}>
          Enter the email associated with your account and we'll send a reset link.
        </Text>

        <Input
          label="Email"
          icon="mail-outline"
          placeholder="Enter your email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Button title="Send Reset Link" onPress={handleReset} loading={loading} />
      </View>
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
  content: {
    backgroundColor: colors.neutral[0],
    borderRadius: 20,
    padding: spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
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
    marginBottom: spacing.sm,
  },
  message: {
    ...typography.body,
    color: colors.neutral[400],
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  error: {
    ...typography.caption,
    color: colors.error[500],
    textAlign: 'center',
    marginBottom: spacing.md,
  },
});
