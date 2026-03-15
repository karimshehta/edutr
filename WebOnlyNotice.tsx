import React, { useState, useCallback, useMemo} from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { supabase } from '../../lib/supabase';
import { Card, ProfDashboardSkeleton } from '../../components';
import { colors, spacing, typography, borderRadius } from '../../theme';
import { Course, Lecture } from '../../types';
import { formatTime, formatFullDate } from '../../lib/helpers';

export function ProfessorDashboard({ navigation }: any) {
  const { profile } = useAuth();
  const { isDark, toggleTheme, colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors, isDark), [colors, isDark]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [todayLectures, setTodayLectures] = useState<(Lecture & { courseName: string })[]>([]);
  const [totalStudents, setTotalStudents] = useState(0);
  const [pendingObjections, setPendingObjections] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!profile) return;
    const { data: assignments } = await supabase.from('course_assignments').select('course_id').eq('user_id', profile.id);
    const { data: created } = await supabase.from('courses').select('id').eq('created_by', profile.id);
    const allIds = [...new Set([...(assignments?.map((a) => a.course_id) || []), ...(created?.map((c) => c.id) || [])])];

    if (allIds.length > 0) {
      const { data: courseData } = await supabase.from('courses').select('*').in('id', allIds).order('name');
      setCourses(courseData || []);
      const activeIds = (courseData || []).filter((c) => c.is_active).map((c) => c.id);

      if (activeIds.length > 0) {
        const today = new Date().getDay();
        const { data: lectureData } = await supabase.from('lectures').select('*').in('course_id', activeIds).eq('day_of_week', today).eq('is_cancelled', false).order('start_time', { ascending: true });
        setTodayLectures((lectureData || []).map((l) => ({ ...l, courseName: courseData?.find((c) => c.id === l.course_id)?.name || '' })));
        // Count ALL students (including blocked) - they're still enrolled
        const { count: sc } = await supabase.from('enrollments').select('id', { count: 'exact', head: true }).in('course_id', activeIds);
        setTotalStudents(sc || 0);
        const { count: oc } = await supabase.from('grade_objections').select('id', { count: 'exact', head: true }).in('course_id', activeIds).eq('status', 'pending');
        setPendingObjections(oc || 0);
      }
    } else {
      setCourses([]); setTodayLectures([]); setTotalStudents(0); setPendingObjections(0);
    }

    const { count } = await supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', profile.id).eq('is_read', false);
    setUnreadCount(count || 0);
    setLoading(false);
  }, [profile]);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));
  const onRefresh = async () => { setRefreshing(true); await loadData(); setRefreshing(false); };

  const greeting = () => {
    const h = new Date().getHours();
    return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  };

  const todayStr = formatFullDate(new Date());

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>{greeting()},</Text>
            <Text style={styles.name}>Prof. {profile?.last_name || profile?.first_name || 'Professor'}</Text>
          </View>
          <View style={styles.headerActions}>
            {/* Dark mode toggle */}
            <TouchableOpacity
              style={styles.headerIconBtn}
              onPress={toggleTheme}
              activeOpacity={0.7}
            >
              <Ionicons
                name={isDark ? 'sunny-outline' : 'moon-outline'}
                size={20}
                color={isDark ? colors.accent[400] : colors.neutral[600]}
              />
            </TouchableOpacity>
            {/* Notifications */}
            <TouchableOpacity
              style={styles.notifBtn}
              onPress={() => navigation.navigate('DashNotifications')}
            >
              <Ionicons name="notifications-outline" size={22} color={colors.neutral[700]} />
              {unreadCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {loading ? (
          <ProfDashboardSkeleton />
        ) : (
          <>
            <View style={styles.statsRow}>
              {[
                { icon: 'book-outline', color: colors.primary[500], val: courses.filter((c) => c.is_active).length, label: 'Courses', onPress: () => navigation.getParent()?.navigate('Courses') },
                { icon: 'people-outline', color: colors.secondary[500], val: totalStudents, label: 'Students', onPress: undefined },
                { icon: 'flag-outline', color: colors.accent[500], val: pendingObjections, label: 'Objections', onPress: () => navigation.getParent()?.navigate('Courses') },
              ].map((s) => (
                <Card key={s.label} style={styles.statCard} onPress={s.onPress}>
                  <Ionicons name={s.icon as any} size={22} color={s.color} />
                  <Text style={styles.statNumber}>{s.val}</Text>
                  <Text style={styles.statLabel}>{s.label}</Text>
                </Card>
              ))}
            </View>

            {todayLectures.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Today's Schedule</Text>
                  <Text style={styles.dateLabel}>{todayStr}</Text>
                </View>
                {todayLectures.map((l) => (
                  <Card key={l.id} style={styles.lectureCard}>
                    <View style={styles.lectureRow}>
                      <View style={styles.timeCol}>
                        <Text style={styles.timeText}>{formatTime(l.start_time)}</Text>
                        <Text style={styles.timeSub}>{formatTime(l.end_time)}</Text>
                      </View>
                      <View style={styles.divider} />
                      <View style={styles.lectureInfo}>
                        <Text style={styles.lectureTitle}>{l.title}</Text>
                        <Text style={styles.lectureCourse}>{l.courseName}</Text>
                        {l.location && (
                          <View style={styles.locRow}>
                            <Ionicons name="location-outline" size={13} color={colors.neutral[400]} />
                            <Text style={styles.locText}>{l.location}</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  </Card>
                ))}
              </View>
            )}
          </>
        )}

        <View style={styles.quickActions}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actionGrid}>
            {[
              { icon: 'add-circle-outline', bg: colors.primary[50], color: colors.primary[500], label: 'Create Course', onPress: () => navigation.navigate('CreateCourse') },
              { icon: 'list-outline', bg: colors.secondary[50], color: colors.secondary[500], label: 'My Courses', onPress: () => navigation.getParent()?.navigate('Courses') },
              { icon: 'calendar-outline', bg: colors.accent[50], color: colors.accent[500], label: 'Schedule', onPress: () => navigation.getParent()?.navigate('Schedule') },
            ].map((a) => (
              <TouchableOpacity key={a.label} style={styles.actionBtn} onPress={a.onPress}>
                <View style={[styles.actionIcon, { backgroundColor: a.bg }]}>
                  <Ionicons name={a.icon as any} size={18} color={a.color} />
                </View>
                <Text style={styles.actionText}>{a.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Text style={styles.powered}>Powered by OMREX</Text>
      </View>
    </View>
  );
}

const makeStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.neutral[50] },
  content: { padding: spacing.md, paddingBottom: spacing.md },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg, paddingTop: spacing.sm },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  headerIconBtn: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.neutral[0],
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  greeting: { ...typography.body, color: colors.neutral[400] },
  name: { ...typography.h2, color: colors.neutral[900], fontWeight: '700' },
  notifBtn: {
    position: 'relative',
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.neutral[0],
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  badge: {
    position: 'absolute', top: 4, right: 4, backgroundColor: colors.error[500],
    minWidth: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3,
  },
  badgeText: { ...typography.small, color: '#fff', fontSize: 10, fontWeight: '700' },
  statsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  statCard: {
    flex: 1, alignItems: 'center', padding: spacing.md,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  statNumber: { ...typography.h2, color: colors.neutral[900], marginTop: spacing.xs },
  statLabel: { ...typography.caption, color: colors.neutral[400], marginTop: 2 },
  section: { marginBottom: spacing.lg },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  sectionTitle: { ...typography.h3, color: colors.neutral[800], fontWeight: '600' },
  dateLabel: { ...typography.caption, color: colors.neutral[400] },
  lectureCard: { marginBottom: spacing.sm, padding: spacing.md },
  lectureRow: { flexDirection: 'row', alignItems: 'center' },
  timeCol: { width: 65, alignItems: 'center' },
  timeText: { ...typography.captionMedium, color: colors.primary[600] },
  timeSub: { ...typography.small, color: colors.neutral[400] },
  divider: { width: 3, height: 36, backgroundColor: colors.primary[100], borderRadius: 2, marginHorizontal: spacing.sm },
  lectureInfo: { flex: 1 },
  lectureTitle: { ...typography.bodyMedium, color: colors.neutral[800], fontWeight: '600' },
  lectureCourse: { ...typography.caption, color: colors.neutral[400], marginTop: 2 },
  locRow: { flexDirection: 'row', alignItems: 'center', marginTop: 3 },
  locText: { ...typography.small, color: colors.neutral[400], marginLeft: 3 },
  quickActions: { marginBottom: spacing.lg },
  actionGrid: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  actionBtn: { flex: 1, alignItems: 'center' },
  actionIcon: { width: 44, height: 44, borderRadius: borderRadius.lg, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xs },
  actionText: { ...typography.caption, color: colors.neutral[600], textAlign: 'center' },
  footer: { paddingVertical: spacing.md, paddingHorizontal: spacing.md, backgroundColor: colors.neutral[0], borderTopWidth: 1, borderTopColor: colors.neutral[100] },
  powered: { ...typography.small, color: colors.neutral[400], textAlign: 'center' },
});
