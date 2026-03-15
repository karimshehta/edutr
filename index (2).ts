import React, { useState, useCallback, useMemo} from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { supabase } from '../../lib/supabase';
import { Button, Card } from '../../components';
import { colors, spacing, typography, borderRadius } from '../../theme';
import { AttendanceSession } from '../../types';
import { calculateDistance } from '../../lib/helpers';
import { useTheme } from '../../contexts/ThemeContext';

export function MarkAttendanceScreen({ route, navigation }: any) {

  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors, isDark), [colors, isDark]);
  const { courseId, courseName } = route.params;
  const { profile } = useAuth();
  const { showToast } = useToast();
  const [session, setSession] = useState<AttendanceSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState(false);
  const [alreadyMarked, setAlreadyMarked] = useState(false);

  const loadSession = useCallback(async () => {
    if (profile) {
      const { data: enrollment } = await supabase
        .from('enrollments')
        .select('is_blocked')
        .eq('course_id', courseId)
        .eq('student_id', profile.id)
        .maybeSingle();

      if (!enrollment) {
        showToast('You are not enrolled in this course', 'error');
        setLoading(false);
        navigation.goBack();
        return;
      }

      if (enrollment.is_blocked) {
        showToast('You have been blocked from this course', 'error');
        setLoading(false);
        navigation.goBack();
        return;
      }
    }

    const { data } = await supabase
      .from('attendance_sessions').select('*')
      .eq('course_id', courseId).eq('is_active', true)
      .is('closed_at', null).maybeSingle();

    setSession(data);

    if (data && profile) {
      if (data.lecture_date) {
        const { data: sameDaySessions } = await supabase
          .from('attendance_sessions').select('id')
          .eq('lecture_id', data.lecture_id).eq('lecture_date', data.lecture_date);

        const sessionIds = (sameDaySessions || []).map(s => s.id);
        if (sessionIds.length > 0) {
          const { data: existingRecord } = await supabase
            .from('attendance_records').select('id')
            .eq('student_id', profile.id).in('session_id', sessionIds)
            .in('status', ['present', 'late']).maybeSingle();
          setAlreadyMarked(!!existingRecord);
        } else {
          setAlreadyMarked(false);
        }
      } else {
        const { data: record } = await supabase
          .from('attendance_records').select('id')
          .eq('session_id', data.id).eq('student_id', profile.id).maybeSingle();
        setAlreadyMarked(!!record);
      }
    } else {
      setAlreadyMarked(false);
    }
    setLoading(false);
  }, [courseId, profile, navigation]);

  useFocusEffect(
    useCallback(() => {
      loadSession();
      const channel = supabase
        .channel(`att-session-${courseId}`)
        .on('postgres_changes', {
          event: '*', schema: 'public', table: 'attendance_sessions',
          filter: `course_id=eq.${courseId}`,
        }, (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const s = payload.new as AttendanceSession;
            if (s.is_active && !s.closed_at) {
              setSession(s);
              if (profile && s.lecture_date) {
                supabase.from('attendance_sessions').select('id')
                  .eq('lecture_id', s.lecture_id).eq('lecture_date', s.lecture_date)
                  .then(({ data: sds }) => {
                    const ids = (sds || []).map(x => x.id);
                    if (ids.length > 0) {
                      supabase.from('attendance_records').select('id')
                        .eq('student_id', profile.id).in('session_id', ids)
                        .in('status', ['present', 'late']).maybeSingle()
                        .then(({ data: rec }) => setAlreadyMarked(!!rec));
                    }
                  });
              }
            } else {
              setSession(null);
              setAlreadyMarked(false);
            }
          } else if (payload.eventType === 'DELETE') {
            setSession(null);
            setAlreadyMarked(false);
          }
        }).subscribe();

      return () => { supabase.removeChannel(channel); };
    }, [courseId, loadSession])
  );

  const handleMarkAttendance = async () => {
    if (!session || !profile) return;
    if (marking) return; // Prevent multiple clicks
    
    setMarking(true);

    // Verify session is still active
    const { data: currentSession } = await supabase
      .from('attendance_sessions').select('*')
      .eq('id', session.id).eq('is_active', true).is('closed_at', null).maybeSingle();

    if (!currentSession) {
      showToast('This attendance session has been closed', 'error');
      setMarking(false);
      loadSession();
      return;
    }

    if (currentSession.professor_latitude == null || currentSession.professor_longitude == null) {
      showToast('Professor location is not available', 'error');
      setMarking(false);
      return;
    }

    // Duplicate check
    if (currentSession.lecture_date) {
      const { data: sameDaySessions } = await supabase
        .from('attendance_sessions').select('id')
        .eq('lecture_id', currentSession.lecture_id).eq('lecture_date', currentSession.lecture_date);
      const sids = (sameDaySessions || []).map(s => s.id);
      if (sids.length > 0) {
        const { data: existingRec } = await supabase
          .from('attendance_records').select('id')
          .eq('student_id', profile.id).in('session_id', sids)
          .in('status', ['present', 'late']).maybeSingle();
        if (existingRec) {
          showToast('You have already marked attendance for this lecture today', 'info');
          setMarking(false);
          setAlreadyMarked(true);
          return;
        }
      }
    }

    // Location permission
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      showToast('Location permission is required to mark attendance', 'error');
      setMarking(false);
      return;
    }

    // Wait patiently until the device returns a real GPS fix.
    // No timeout, no cached lookup — getCurrentPositionAsync blocks until
    // the OS delivers actual coordinates, even if the user takes several
    // minutes to enable location services.
    let location: Location.LocationObject;
    try {
      location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
    } catch (err) {
      showToast('Could not get your location. Please enable GPS and try again.', 'error');
      setMarking(false);
      return;
    }

    const studentLat = location.coords.latitude;
    const studentLng = location.coords.longitude;

    // Distance check
    const dist = calculateDistance(
      currentSession.professor_latitude, currentSession.professor_longitude,
      studentLat, studentLng
    );

    const allowedRadius = currentSession.radius_meters ?? 50;
    if (dist > allowedRadius) {
      showToast(
        `You are ${Math.round(dist)}m away. Must be within ${allowedRadius}m`,
        'error'
      );
      setMarking(false);
      return;
    }

    // Mark attendance
    const { error } = await supabase.from('attendance_records').insert({
      session_id: currentSession.id,
      student_id: profile.id,
      marked_at: new Date().toISOString(),
      distance_meters: Math.round(dist),
      student_latitude: studentLat,
      student_longitude: studentLng,
      status: 'present',
      marked_manually: false,
    });

    setMarking(false);
    if (error) {
      if (error.code === '23505') {
        showToast('You have already marked attendance for this session', 'info');
        setAlreadyMarked(true);
      } else {
        showToast('Failed to mark attendance', 'error');
      }
    } else {
      setAlreadyMarked(true);
      showToast('Attendance marked successfully!');
    }
  };

  if (loading) return <View style={styles.container} />;

  return (
    <View style={styles.container}>
      <Card style={styles.card}>
        {!session ? (
          <>
            <View style={[styles.iconWrap, { backgroundColor: colors.neutral[100] }]}>
              <Ionicons name="time-outline" size={44} color={colors.neutral[400]} />
            </View>
            <Text style={styles.title}>No Active Session</Text>
            <Text style={styles.message}>
              There is no attendance session currently open for {courseName}. Wait for your professor to start one.
            </Text>
          </>
        ) : alreadyMarked ? (
          <>
            <View style={[styles.iconWrap, { backgroundColor: colors.success[50] }]}>
              <Ionicons name="checkmark-circle" size={44} color={colors.success[500]} />
            </View>
            <Text style={styles.title}>Already Checked In</Text>
            <Text style={styles.message}>You have already marked your attendance for this session.</Text>
          </>
        ) : (
          <>
            <View style={[styles.iconWrap, { backgroundColor: colors.primary[50] }]}>
              <Ionicons name="location" size={44} color={colors.primary[500]} />
            </View>
            <Text style={styles.title}>Mark Attendance</Text>
            <Text style={styles.message}>
              An attendance session is active for {courseName}. Tap below to check in.
            </Text>
            <View style={styles.infoRow}>
              <Ionicons name="navigate-outline" size={14} color={colors.neutral[400]} />
              <Text style={styles.infoText}>Required range: {session.radius_meters}m</Text>
            </View>
            <Button 
              title={marking ? "Checking In..." : "Check In Now"} 
              onPress={handleMarkAttendance} 
              loading={marking}
              disabled={marking}
              style={{ marginTop: spacing.lg, width: '100%' }} 
            />
          </>
        )}
      </Card>
    </View>
  );
}

const makeStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.neutral[50], justifyContent: 'center', padding: spacing.lg },
  card: { alignItems: 'center', padding: spacing.xl },
  iconWrap: {
    width: 88, height: 88, borderRadius: 44,
    alignItems: 'center', justifyContent: 'center', marginBottom: spacing.lg,
  },
  title: { ...typography.h3, color: colors.neutral[900], marginBottom: spacing.sm, textAlign: 'center' },
  message: { ...typography.body, color: colors.neutral[500], textAlign: 'center', marginBottom: spacing.sm, lineHeight: 22 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  infoText: { ...typography.caption, color: colors.neutral[400] },
});
