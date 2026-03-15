import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Image, ActivityIndicator } from 'react-native';
import { colors, spacing } from '../theme';

export function LoadingScreen({ splash }: { splash?: boolean; message?: string }) {
  // ── Simple spinner (after login, profile loading) ──────────────────────────
  if (!splash) {
    return (
      <View style={styles.simple}>
        <ActivityIndicator size="large" color={colors.primary[500]} />
      </View>
    );
  }

  // ── Full animated splash (app first boot only) ─────────────────────────────
  return <SplashAnimation />;
}

function SplashAnimation() {
  const logoScale   = useRef(new Animated.Value(0.75)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const textY       = useRef(new Animated.Value(12)).current;
  const dot1        = useRef(new Animated.Value(0.3)).current;
  const dot2        = useRef(new Animated.Value(0.3)).current;
  const dot3        = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(logoScale,   { toValue: 1, friction: 6, tension: 80, useNativeDriver: true }),
      Animated.timing(logoOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();

    Animated.sequence([
      Animated.delay(200),
      Animated.parallel([
        Animated.timing(textOpacity, { toValue: 1, duration: 350, useNativeDriver: true }),
        Animated.timing(textY,       { toValue: 0, duration: 350, useNativeDriver: true }),
      ]),
    ]).start();

    const pulse = (dot: Animated.Value, delay: number) =>
      Animated.loop(Animated.sequence([
        Animated.delay(delay),
        Animated.timing(dot, { toValue: 1,   duration: 400, useNativeDriver: true }),
        Animated.timing(dot, { toValue: 0.3, duration: 400, useNativeDriver: true }),
      ])).start();

    pulse(dot1, 0);
    pulse(dot2, 150);
    pulse(dot3, 300);
  }, []);

  return (
    <View style={styles.container}>
      <Animated.View style={{ opacity: logoOpacity, transform: [{ scale: logoScale }] }}>
        <Image source={require('../../assets/splash-icon.png')} style={styles.logo} resizeMode="contain" />
      </Animated.View>

      <Animated.View style={{ opacity: textOpacity, transform: [{ translateY: textY }], alignItems: 'center' }}>
        <Text style={styles.appName}>EduTracker</Text>
        <Text style={styles.tagline}>Smart Attendance · Grades · Schedule</Text>
      </Animated.View>

      <Animated.View style={[styles.dotsRow, { opacity: textOpacity }]}>
        <Animated.View style={[styles.dot, { opacity: dot1 }]} />
        <Animated.View style={[styles.dot, { opacity: dot2 }]} />
        <Animated.View style={[styles.dot, { opacity: dot3 }]} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  simple: {
    flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF',
  },
  container: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#FFFFFF', gap: spacing.lg,
  },
  logo:    { width: 130, height: 130 },
  appName: { fontSize: 32, fontWeight: '800', color: colors.primary[600], letterSpacing: -0.5, marginBottom: 6 },
  tagline: { fontSize: 12, fontWeight: '500', color: colors.neutral[400], letterSpacing: 0.3 },
  dotsRow: { flexDirection: 'row', gap: 8, marginTop: spacing.md },
  dot:     { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.primary[500] },
});


