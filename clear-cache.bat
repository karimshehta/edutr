import React, { useState, useMemo} from 'react';
import {
  View, Text, StyleSheet, KeyboardAvoidingView, Platform,
  ScrollView, TouchableOpacity, TextInput, Image,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { supabase } from '../../lib/supabase';
import { colors, spacing, typography } from '../../theme';
import { useTheme } from '../../contexts/ThemeContext';

type Props = { navigation: NativeStackNavigationProp<any> };

export function LoginScreen({ navigation }: Props) {

  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors, isDark), [colors, isDark]);
  const { showToast } = useToast();
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isEmailUnverified, setIsEmailUnverified] = useState(false);
  const [resendingEmail, setResendingEmail] = useState(false);

  const handleResendVerification = async () => {
    if (!email.trim()) return;
    setResendingEmail(true);
    try {
      const { error } = await supabase.auth.resend({ type: 'signup', email: email.trim() });
      if (error) throw error;
      showToast('Verification email sent! Check your inbox and click the link.', 'success', 5000);
    } catch (err: any) {
      showToast(err.message || 'Failed to resend verification email.', 'error', 4000);
    } finally {
      setResendingEmail(false);
    }
  };

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setError('Please enter your email and password.');
      setIsEmailUnverified(false);
      return;
    }
    setError('');
    setIsEmailUnverified(false);
    setLoading(true);
    const { error: err } = await signIn(email.trim(), password);
    setLoading(false);
    if (err) {
      if (err.toLowerCase().includes('email not confirmed') || err.toLowerCase().includes('email not verified')) {
        setError('Your email is not verified yet. Please check your email and click the verification link.');
        setIsEmailUnverified(true);
      } else {
        // Supabase returns "Invalid login credentials" — replace with a clearer message
        const displayError =
          err.toLowerCase().includes('invalid login credentials') ||
          err.toLowerCase().includes('invalid credentials')
            ? 'Incorrect email or password'
            : err;
        setError(displayError);
        setIsEmailUnverified(false);
      }
    }
  };

  return (
    <LinearGradient colors={['#0B3A53', '#1A8AD4', '#58B5EE']} style={styles.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {/* Logo */}
          <View style={styles.header}>
            <View style={styles.logoCircle}>
              <Image 
                source={require('../../../assets/icon-round.png')} 
                style={styles.logoImage}
                resizeMode="contain"
              />
            </View>
            <Text style={styles.appName}>EduTracker</Text>
            <Text style={styles.tagline}>Your academic companion</Text>
            <View style={styles.poweredPill}>
              <Text style={styles.poweredText}>Powered by OMREX</Text>
            </View>
          </View>

          {/* Form Card */}
          <View style={styles.card}>
            <Text style={styles.welcomeText}>Welcome Back</Text>
            <Text style={styles.subtitleText}>Sign in to continue</Text>

            {/* Email */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email</Text>
              <View style={styles.inputWrap}>
                <Ionicons name="mail-outline" size={20} color={colors.neutral[400]} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Enter your email"
                  placeholderTextColor={colors.neutral[400]}
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoComplete="email"
                />
              </View>
            </View>

            {/* Password */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Password</Text>
              <View style={styles.inputWrap}>
                <Ionicons name="lock-closed-outline" size={20} color={colors.neutral[400]} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Enter your password"
                  placeholderTextColor={colors.neutral[400]}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoComplete="password"
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
                  <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.neutral[400]} />
                </TouchableOpacity>
              </View>
            </View>

            {error ? (
              <View style={[styles.errorBox, isEmailUnverified && styles.warningBox]}>
                <Ionicons name={isEmailUnverified ? 'warning-outline' : 'alert-circle-outline'} size={18} color={isEmailUnverified ? colors.warning[600] : colors.error[500]} />
                <Text style={[styles.errorText, isEmailUnverified && styles.warningText]}>{error}</Text>
                {isEmailUnverified && (
                  <TouchableOpacity onPress={handleResendVerification} disabled={resendingEmail} style={styles.resendBtn}>
                    <Ionicons name="mail-outline" size={14} color={colors.primary[500]} />
                    <Text style={styles.resendText}>{resendingEmail ? 'Sending...' : 'Resend Email'}</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : null}

            {/* Login Button */}
            <TouchableOpacity
              style={[styles.loginBtn, loading && styles.loginBtnDisabled]}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.8}
            >
              <LinearGradient colors={['#1A8AD4', '#146FA8']} style={styles.loginBtnGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                {loading ? (
                  <Text style={styles.loginBtnText}>Signing in...</Text>
                ) : (
                  <>
                    <Text style={styles.loginBtnText}>Sign In</Text>
                    <Ionicons name="arrow-forward" size={20} color="#fff" />
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => navigation.navigate('ForgotPassword')} style={styles.forgotBtn}>
              <Text style={styles.forgotText}>Forgot Password?</Text>
            </TouchableOpacity>

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            <TouchableOpacity onPress={() => navigation.navigate('Register')} style={styles.registerBtn}>
              <Text style={styles.registerText}>Don't have an account? </Text>
              <Text style={styles.registerLink}>Sign up</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const makeStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  gradient: { flex: 1 },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: spacing.lg, paddingBottom: spacing.xxl },
  header: { alignItems: 'center', marginBottom: spacing.xl },
  logoCircle: {
    width: 100, 
    height: 100, 
    borderRadius: 50,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    alignItems: 'center', 
    justifyContent: 'center', 
    marginBottom: spacing.md,
  },
  logoImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  appName: { ...typography.h1, color: '#fff', marginBottom: 4 },
  tagline: { ...typography.body, color: 'rgba(255,255,255,0.8)' },
  poweredPill: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 14, paddingVertical: 5, borderRadius: 20, marginTop: spacing.sm,
  },
  poweredText: { ...typography.small, color: 'rgba(255,255,255,0.9)', fontWeight: '600' },

  card: {
    backgroundColor: '#fff', borderRadius: 24, padding: spacing.lg,
    shadowColor: '#000', shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.15, shadowRadius: 24, elevation: 8,
  },
  welcomeText: { ...typography.h2, color: colors.neutral[900], marginBottom: 4 },
  subtitleText: { ...typography.body, color: colors.neutral[400], marginBottom: spacing.lg },

  inputGroup: { marginBottom: spacing.md },
  label: { ...typography.captionMedium, color: colors.neutral[700], marginBottom: 8 },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.neutral[50], borderRadius: 14,
    borderWidth: 1.5, borderColor: colors.neutral[200],
    paddingHorizontal: spacing.md, height: 54,
  },
  inputIcon: { marginRight: spacing.sm },
  input: { flex: 1, ...typography.body, color: colors.neutral[900] },
  eyeBtn: { padding: spacing.xs },

  errorBox: {
    flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8,
    backgroundColor: colors.error[50], borderRadius: 12, padding: spacing.md,
    marginBottom: spacing.md, borderWidth: 1, borderColor: colors.error[100],
  },
  warningBox: { backgroundColor: colors.warning[50], borderColor: colors.warning[100] },
  errorText: { ...typography.caption, color: colors.error[600], flex: 1 },
  warningText: { color: colors.warning[700] },
  resendBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingVertical: 6, paddingHorizontal: 12,
    backgroundColor: '#fff', borderRadius: 8, borderWidth: 1, borderColor: colors.primary[200],
    marginTop: 4, width: '100%', justifyContent: 'center',
  },
  resendText: { ...typography.captionMedium, color: colors.primary[600] },

  loginBtn: { marginTop: spacing.sm, borderRadius: 14, overflow: 'hidden' },
  loginBtnDisabled: { opacity: 0.7 },
  loginBtnGradient: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 16, gap: 8,
  },
  loginBtnText: { ...typography.button, color: '#fff', fontSize: 17 },

  forgotBtn: { alignItems: 'center', marginTop: spacing.md, padding: spacing.sm },
  forgotText: { ...typography.captionMedium, color: colors.primary[500] },

  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: spacing.md },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.neutral[200] },
  dividerText: { ...typography.caption, color: colors.neutral[400], marginHorizontal: spacing.md },

  registerBtn: { flexDirection: 'row', justifyContent: 'center', padding: spacing.sm },
  registerText: { ...typography.body, color: colors.neutral[500] },
  registerLink: { ...typography.bodyMedium, color: colors.primary[500], fontWeight: '600' },
});
