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
import { colors, spacing, typography } from '../../theme';
import { useTheme } from '../../contexts/ThemeContext';

type Props = { navigation: NativeStackNavigationProp<any> };

export function RegisterScreen({ navigation }: Props) {

  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors, isDark), [colors, isDark]);
  const { signUp } = useAuth();
  const { showToast } = useToast();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<'student' | 'professor'>('student');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = (): boolean => {
    const e: Record<string, string> = {};
    if (!firstName.trim()) e.firstName = 'First name is required.';
    if (!lastName.trim()) e.lastName = 'Last name is required.';
    if (!email.trim()) e.email = 'Email is required.';
    else if (!email.includes('@')) e.email = 'Please enter a valid email.';
    if (!password.trim()) e.password = 'Password is required.';
    else if (password.length < 6) e.password = 'Password must be at least 6 characters.';
    if (password !== confirmPassword) e.confirmPassword = 'Passwords do not match.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleRegister = async () => {
    if (!validateForm()) return;
    setLoading(true);

    const { error } = await signUp(email.trim(), password, {
      role, 
      first_name: firstName.trim(), 
      last_name: lastName.trim(), 
      plan: 'free',
    });
    setLoading(false);
    if (error) { setErrors({ submit: error }); return; }
    setErrors({});
    const message = role === 'professor'
      ? 'Please verify your email via the link sent to you.'
      : 'Account created! Check your email to verify before signing in.';
    showToast(message, 'success', 5000);
    navigation.replace('Login');
  };

  const renderInput = (label: string, icon: keyof typeof Ionicons.glyphMap, value: string, onChange: (t: string) => void, opts: any = {}) => (
    <View style={styles.inputGroup}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.inputWrap, opts.error && styles.inputError]}>
        <Ionicons name={icon} size={20} color={colors.neutral[400]} style={styles.inputIcon} />
        <TextInput
          style={styles.input}
          placeholder={opts.placeholder || ''}
          placeholderTextColor={colors.neutral[400]}
          value={value}
          onChangeText={onChange}
          secureTextEntry={opts.secure && !showPassword}
          autoCapitalize={opts.autoCapitalize || 'sentences'}
          keyboardType={opts.keyboardType || 'default'}
        />
        {opts.secure && (
          <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
            <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.neutral[400]} />
          </TouchableOpacity>
        )}
      </View>
      {opts.error ? <Text style={styles.fieldError}>{opts.error}</Text> : null}
    </View>
  );

  return (
    <LinearGradient colors={['#0B3A53', '#1A8AD4', '#58B5EE']} style={styles.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <View style={styles.logoCircle}>
              <Image 
                source={require('../../../assets/icon-round.png')} 
                style={styles.logoImage}
                resizeMode="contain"
              />
            </View>
            <Text style={styles.appName}>EduTracker</Text>
            <View style={styles.poweredPill}>
              <Text style={styles.poweredText}>Powered by OMREX</Text>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.welcomeText}>Create Account</Text>
            <Text style={styles.subtitleText}>Join the platform</Text>

            {renderInput('First Name', 'person-outline', firstName, setFirstName, { placeholder: 'Enter your first name', error: errors.firstName })}
            {renderInput('Last Name', 'person-outline', lastName, setLastName, { placeholder: 'Enter your last name', error: errors.lastName })}
            {renderInput('Email', 'mail-outline', email, setEmail, { placeholder: 'Enter your email', autoCapitalize: 'none', keyboardType: 'email-address', error: errors.email })}
            {renderInput('Password', 'lock-closed-outline', password, setPassword, { placeholder: 'Min 6 characters', secure: true, error: errors.password })}
            {renderInput('Confirm Password', 'lock-closed-outline', confirmPassword, setConfirmPassword, { placeholder: 'Re-enter password', secure: true, error: errors.confirmPassword })}

            <Text style={styles.roleLabel}>I am a:</Text>
            <View style={styles.roleRow}>
              {(['student', 'professor'] as const).map((r) => (
                <TouchableOpacity
                  key={r}
                  style={[styles.roleBtn, role === r && styles.roleBtnActive]}
                  onPress={() => setRole(r)}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={r === 'student' ? 'person-outline' : 'briefcase-outline'}
                    size={20}
                    color={role === r ? colors.primary[600] : colors.neutral[400]}
                  />
                  <Text style={[styles.roleBtnText, role === r && styles.roleBtnTextActive]}>
                    {r.charAt(0).toUpperCase() + r.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {errors.submit ? (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle-outline" size={18} color={colors.error[500]} />
                <Text style={styles.errorText}>{errors.submit}</Text>
              </View>
            ) : null}

            <TouchableOpacity
              style={[styles.registerButton, loading && styles.registerBtnDisabled]}
              onPress={handleRegister}
              disabled={loading}
              activeOpacity={0.8}
            >
              <LinearGradient colors={['#1A8AD4', '#146FA8']} style={styles.registerBtnGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                <Text style={styles.registerBtnText}>{loading ? 'Creating...' : 'Create Account'}</Text>
                {!loading && <Ionicons name="arrow-forward" size={20} color="#fff" />}
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => navigation.navigate('Login')} style={styles.loginLink}>
              <Text style={styles.loginLinkText}>Already have an account? </Text>
              <Text style={styles.loginLinkBold}>Sign in</Text>
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
  header: { alignItems: 'center', marginBottom: spacing.lg },
  logoCircle: {
    width: 88, 
    height: 88, 
    borderRadius: 44,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    alignItems: 'center', 
    justifyContent: 'center', 
    marginBottom: spacing.sm,
  },
  logoImage: {
    width: 88,
    height: 88,
    borderRadius: 44,
  },
  appName: { ...typography.h2, color: '#fff', marginBottom: 4 },
  poweredPill: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 14, paddingVertical: 4, borderRadius: 20, marginTop: spacing.xs,
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
    paddingHorizontal: spacing.md, height: 52,
  },
  inputError: { borderColor: colors.error[400] },
  inputIcon: { marginRight: spacing.sm },
  input: { flex: 1, ...typography.body, color: colors.neutral[900] },
  eyeBtn: { padding: spacing.xs },
  fieldError: { ...typography.small, color: colors.error[500], marginTop: 4, marginLeft: 4 },
  roleLabel: { ...typography.captionMedium, color: colors.neutral[700], marginBottom: spacing.sm },
  roleRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  roleBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: colors.neutral[200], borderRadius: 14,
    paddingVertical: 14, gap: spacing.xs, backgroundColor: colors.neutral[50],
  },
  roleBtnActive: { backgroundColor: colors.primary[50], borderColor: colors.primary[400] },
  roleBtnText: { ...typography.captionMedium, color: colors.neutral[500] },
  roleBtnTextActive: { color: colors.primary[600], fontWeight: '600' },
  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.error[50], borderRadius: 12, padding: spacing.md,
    marginBottom: spacing.md, borderWidth: 1, borderColor: colors.error[100],
  },
  errorText: { ...typography.caption, color: colors.error[600], flex: 1 },
  registerButton: { marginTop: spacing.sm, borderRadius: 14, overflow: 'hidden' },
  registerBtnDisabled: { opacity: 0.7 },
  registerBtnGradient: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 16, gap: 8,
  },
  registerBtnText: { ...typography.button, color: '#fff', fontSize: 17 },
  loginLink: { flexDirection: 'row', justifyContent: 'center', padding: spacing.sm, marginTop: spacing.md },
  loginLinkText: { ...typography.body, color: colors.neutral[500] },
  loginLinkBold: { ...typography.bodyMedium, color: colors.primary[500], fontWeight: '600' },
});
