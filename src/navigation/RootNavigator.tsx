import React, { useEffect, useRef } from 'react';
import { NavigationContainer, NavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as Linking from 'expo-linking';
import * as Notifications from 'expo-notifications';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useTheme } from '../contexts/ThemeContext';
import { LoadingScreen } from '../components';
import { AuthStack } from './AuthStack';
import { StudentTabs } from './StudentTabs';
import { ProfessorTabs } from './ProfessorTabs';
import { PendingApprovalScreen } from '../screens/auth/PendingApprovalScreen';
import { RejectedScreen } from '../screens/auth/RejectedScreen';
import { WebOnlyNotice } from '../screens/shared/WebOnlyNotice';
import { ResetPasswordScreen } from '../screens/auth/ResetPasswordScreen';
import { supabase } from '../lib/supabase';
import { registerExpoPushToken } from '../lib/pushNotifications';
import { colors } from '../theme';

const RootStack = createNativeStackNavigator();

function parseAllUrlParams(url: string): Record<string, string> {
  const out: Record<string, string> = {};
  try {
    const qi = url.indexOf('?');
    const hi = url.indexOf('#');

    const addPairs = (str: string) =>
      str.split('&').forEach((pair) => {
        const eq = pair.indexOf('=');
        if (eq < 1) return;
        const k = decodeURIComponent(pair.slice(0, eq));
        const v = decodeURIComponent(pair.slice(eq + 1));
        if (k) out[k] = v;
      });

    if (qi !== -1) addPairs(url.slice(qi + 1, hi !== -1 ? hi : undefined));
    if (hi !== -1) addPairs(url.slice(hi + 1));
  } catch {
    // Silently ignore malformed URLs
  }
  return out;
}

function MainScreen() {
  const { session, profile, loading } = useAuth();
  const { isDark, resetTheme } = useTheme();

  useEffect(() => {
    if (!loading && !session && isDark) {
      resetTheme();
    }
  }, [loading, session, isDark, resetTheme]);

  useEffect(() => {
    if (session?.user?.id && profile && (profile.role === 'student' || profile.role === 'professor')) {
      registerExpoPushToken(session.user.id);
    }
  }, [session?.user?.id, profile?.role]);

  if (loading) return <LoadingScreen splash />;
  if (!session) return <AuthStack />;
  if (!profile) return <LoadingScreen />;
  if (profile.status === 'pending') return <PendingApprovalScreen />;
  if (profile.status === 'rejected') return <RejectedScreen />;
  if (profile.role === 'admin' || profile.role === 'user') return <WebOnlyNotice />;
  if (profile.role === 'student') {
    if (profile.status === 'pending') return <PendingApprovalScreen />;
    if (profile.status === 'rejected') return <RejectedScreen />;
    return <StudentTabs />;
  }
  return <ProfessorTabs />;
}

export function RootNavigator() {
  const { showToast } = useToast();
  const navigationRef = useRef<NavigationContainerRef<any>>(null);
  const pendingScreen = useRef<string | null>(null);

  const navigateSafely = (screen: string) => {
    if (navigationRef.current?.isReady()) {
      navigationRef.current.navigate(screen as never);
    } else {
      pendingScreen.current = screen;
    }
  };

  const handleDeepLink = async (url: string) => {
    console.log('[DeepLink] Received:', url);

    const { hostname, path } = Linking.parse(url);
    const target = hostname || path || '';
    const params = parseAllUrlParams(url);

    const accessToken = params['access_token'];
    const refreshToken = params['refresh_token'];
    const tokenType = params['type'];

    console.log('[DeepLink] target=%s type=%s tokens=%s', target, tokenType, !!(accessToken && refreshToken));

    if (target === 'reset-password' || tokenType === 'recovery') {
      if (!accessToken || !refreshToken) {
        showToast('Invalid or expired reset link. Please request a new one.', 'error', 4000);
        return;
      }

      console.log('[DeepLink] Setting session for password recovery…');
      const { error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });

      if (error) {
        console.error('[DeepLink] setSession (recovery) failed:', error.message);
        showToast('Invalid or expired reset link. Please request a new one.', 'error', 4000);
        return;
      }

      console.log('[DeepLink] Recovery session confirmed — navigating to ResetPassword');
      navigateSafely('ResetPassword');
      return;
    }

    if (target === 'auth' || tokenType === 'signup' || tokenType === 'magiclink') {
      if (!accessToken || !refreshToken) return;

      console.log('[DeepLink] Setting session for email confirmation…');
      const { error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });

      if (error) {
        console.error('[DeepLink] setSession (signup) failed:', error.message);
        showToast('Email verification failed. Please try again.', 'error', 4000);
        return;
      }

      console.log('[DeepLink] Email confirmed — session established');
      return;
    }

    console.log('[DeepLink] Unhandled link target:', target);
  };

  useEffect(() => {
    Linking.getInitialURL().then((url) => {
      if (url) {
        console.log('[DeepLink] Initial URL:', url);
        handleDeepLink(url);
      }
    });

    const sub = Linking.addEventListener('url', ({ url }) => {
      console.log('[DeepLink] Foreground URL:', url);
      handleDeepLink(url);
    });

    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      console.log('[AuthState] Event:', event);
      if (event === 'PASSWORD_RECOVERY') {
        console.log('[AuthState] PASSWORD_RECOVERY — navigating to ResetPassword');
        navigateSafely('ResetPassword');
      }
    });
    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle notification tap — bring app to foreground (already handled by OS)
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener(() => {
      // App is already brought to foreground by OS tap
      // Additional deep-link routing can be added here if needed
    });
    return () => sub.remove();
  }, []);

  return (
    <NavigationContainer
      ref={navigationRef}
      onReady={() => {
        if (pendingScreen.current) {
          console.log('[Nav] Flushing pending navigation to:', pendingScreen.current);
          navigationRef.current?.navigate(pendingScreen.current as never);
          pendingScreen.current = null;
        }
      }}
    >
      <RootStack.Navigator
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.neutral[50] },
          animation: 'slide_from_right',
        }}
      >
        <RootStack.Screen name="Main" component={MainScreen} />
        <RootStack.Screen
          name="ResetPassword"
          component={ResetPasswordScreen}
          options={{ presentation: 'fullScreenModal' }}
        />
      </RootStack.Navigator>
    </NavigationContainer>
  );
}
