import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { supabase } from '../../lib/supabase';
import { Card, Badge, StatsGridSkeleton, CardSkeleton } from '../../components';
import { colors, spacing, typography, borderRadius, elevation } from '../../theme';
import { Course, Lecture, Grade, UserProfile } from '../../types';
import { formatTime, formatFullDate } from '../../lib/helpers';

type LectureWithCourse = Lecture & { courseName: string };

type CourseWithMeta = Course & {
  is_blocked?: boolean;
  is_locked?: boolean;
  student_count?: number;
  schedule_count?: number;
};

function getSubscriptionStatus(profile: UserProfile | null): { isGracePeriod: boolean; isExpired: boolean } {
  if (!profile || !profile.plan || profile.plan === 'free') {
    return { isGracePeriod: false, isExpired: false };
  }

  const now = new Date();
  const endDate = profile.subscription_end_date ? new Date(profile.subscription_end_date) : null;

  if (!endDate) return { isGracePeriod: false, isExpired: false };

  if (now <= endDate) return { isGracePeriod: false, isExpired: false };

  const graceExpiry = new Date(endDate);
  graceExpiry.setDate(graceExpiry.getDate() + 7);

  if (now <= graceExpiry) return { isGracePeriod: true, isExpired: false };

  return { isGracePeriod: false, isExpired: true };
}

export function StudentDashboard({ navigation }: any) {
  const { profile } = useAuth();
  const { isDark, toggleTheme, colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors, isDark), [colors, isDark]);
  const [courses, setCourses] = useState<CourseWithMeta[]>([]);
  const [todayLectures, setTodayLectures] = useState<LectureWithCourse[]>([]);
  const [recentGrades, setRecentGrades] = useState<(Grade & { courseName: string })[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const subStatus = useMemo(() => getSubscriptionStatus(profile), [profile]);

  const loadData = useCallback(async () => {
    if (!profile) return;
    const { data: enrollments } = await supabase.from('enrollments').select('course_id, is_blocked').eq('student_id', profile.id);
    const allCourseIds = enrollments?.map((e) => e.course_id) || [];

    if (allCourseIds.length > 0) {
      const { data: courseData } = await supabase
        .from('courses').select('*').in('id', allCourseIds).eq('is_active', true);

      const blockedIds = new Set((enrollments || []).filter(e => e.is_blocked).map(e => e.course_id));

      const coursesWithMeta: CourseWithMeta[] = (courseData || []).map((c) => ({
        ...c,
        is_blocked: blockedIds.has(c.id),
        is_locked: c.is_plan_locked === true,
        student_count: 0,
        schedule_count: 0,
      }));
      setCourses(coursesWithMeta);

      const accessibleIds = coursesWithMeta
        .filter(c => !c.is_blocked && !c.is_locked)
        .map(c => c.id);

      if (accessibleIds.length > 0) {
        const today = new Date().getDay();
        const { data: lectureData } = await supabase
          .from('lectures').select('*')
          .in('course_id', accessibleIds)
          .eq('day_of_week', today)
          .eq('is_cancelled', false)
          .order('start_time', { ascending: true });

        setTodayLectures((lectureData || []).map((l) => ({
          ...l,
          courseName: courseData?.find((c) => c.id === l.course_id)?.name || '',
        })));

        const { data: allLectures } = await supabase
          .from('lectures').select('course_id')
          .in('course_id', accessibleIds);

        const scheduleCountByCourse: Record<string, number> = {};
        for (const l of allLectures || []) {
          scheduleCountByCourse[l.course_id] = (scheduleCountByCourse[l.course_id] || 0) + 1;
        }

        const { data: allEnrollmentsForCount } = await supabase
          .from('enrollments').select('course_id')
          .in('course_id', accessibleIds).eq('is_blocked', false);

        const studentCountByCourse: Record<string, number> = {};
        for (const e of allEnrollmentsForCount || []) {
          studentCountByCourse[e.course_id] = (studentCountByCourse[e.course_id] || 0) + 1;
        }

        setCourses(prev => prev.map(c => ({
          ...c,
          schedule_count: scheduleCountByCourse[c.id] || 0,
          student_count: studentCountByCourse[c.id] || 0,
        })));

        const { data: gradeData } = await supabase.from('grades').select('*').eq('student_id', profile.id).eq('is_published', true).in('course_id', accessibleIds).order('published_at', { ascending: false }).limit(5);
        setRecentGrades((gradeData || []).map((g) => ({ ...g, courseName: courseData?.find((c) => c.id === g.course_id)?.name || '' })));
      } else {
        setTodayLectures([]);
        setRecentGrades([]);
      }
    } else {
      setCourses([]); setTodayLectures([]); setRecentGrades([]);
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

  const accessibleCount = useMemo(() => courses.filter(c => !c.is_blocked && !c.is_locked).length, [courses]);

  const statsData = useMemo(() => [
    { icon: 'book', bg: colors.primary[50], color: colors.primary[600], val: accessibleCount, label: 'Courses' },
    { icon: 'school', bg: colors.accent[50], color: colors.accent[600], val: recentGrades.length, label: 'Grades' },
    { icon: 'calendar', bg: colors.secondary[50], color: colors.secondary[600], val: todayLectures.length, label: 'Today' },
  ], [accessibleCount, recentGrades.length, todayLectures.length]);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />} showsVerticalScrollIndicator={false}>

        {/* Subscription banners */}
        {!loading && subStatus.isGracePeriod && (
          <View style={styles.graceBanner}>
            <Ionicons name="warning-outline" size={16} color={colors.warning[600]} />
            <Text style={styles.graceBannerText}>Some courses may become unavailable soon. Contact your instructor for support.</Text>
          </View>
        )}
        {!loading && subStatus.isExpired && (
          <View style={styles.expiredBanner}>
            <Ionicons name="warning-outline" size={16} color={colors.error[600]} />
            <Text style={styles.expiredBannerText}>Some courses are not available at the moment. Please contact your instructor.</Text>
          </View>
        )}

        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>{greeting()},</Text>
            <Text style={styles.name}>{profile?.first_name || 'Student'}</Text>
          </View>
          <View style={styles.headerActions}>
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

        {/* Overview */}
        {loading ? (
          <StatsGridSkeleton />
        ) : (
          <View style={styles.overviewCard}>
            <Text style={styles.overviewTitle}>Overview</Text>
            <View style={styles.statsGrid}>
              {statsData.map((s) => (
                <View key={s.label} style={styles.statItem}>
                  <View style={[styles.statIconBox, { backgroundColor: s.bg }]}>
                    <Ionicons name={s.icon as any} size={20} color={s.color} />
                  </View>
                  <Text style={styles.statValue}>{s.val}</Text>
                  <Text style={styles.statLabel}>{s.label}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* My Courses section */}
        {loading ? (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>My Courses</Text>
            </View>
            <CardSkeleton />
            <CardSkeleton />
          </View>
        ) : courses.length > 0 ? (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>My Courses</Text>
              <TouchableOpacity onPress={() => navigation.navigate('Courses')}>
                <Text style={styles.seeAll}>See All</Text>
              </TouchableOpacity>
            </View>
            {courses.map((c) => {
              if (c.is_blocked) {
                return (
                  <View key={c.id} style={[styles.miniCourseCard, styles.blockedMiniCard]}>
                    <View style={styles.miniCourseTop}>
                      <View style={[styles.miniCodeBox, styles.blockedCodeBox]}>
                        <Text style={[styles.miniCodeText, styles.blockedCodeText]}>{c.code}</Text>
                      </View>
                      <Text style={styles.miniSemester}>{c.semester}</Text>
                    </View>
                    <Text style={styles.miniCourseName} numberOfLines={1}>{c.name}</Text>
                    <Text style={styles.blockedLabel}>Blocked from this course</Text>
                  </View>
                );
              }
              if (c.is_locked) {
                return (
                  <View key={c.id} style={[styles.miniCourseCard, styles.lockedMiniCard]}>
                    <View style={styles.miniCourseTop}>
                      <View style={[styles.miniCodeBox, styles.lockedCodeBox]}>
                        <Text style={[styles.miniCodeText, styles.lockedCodeText]}>{c.code}</Text>
                      </View>
                      <Text style={styles.miniSemester}>{c.semester}</Text>
                    </View>
                    <Text style={styles.miniCourseName} numberOfLines={1}>{c.name}</Text>
                    <Text style={styles.lockedLabel}>Temporarily unavailable</Text>
                  </View>
                );
              }
              return (
                <TouchableOpacity
                  key={c.id}
                  style={styles.miniCourseCard}
                  onPress={() => navigation.navigate('Courses', { screen: 'CourseDetail', params: { courseId: c.id, courseName: c.name } })}
                  activeOpacity={0.7}
                >
                  <View style={styles.miniCourseTop}>
                    <View style={styles.miniCodeBox}>
                      <Text style={styles.miniCodeText}>{c.code}</Text>
                    </View>
                    <Text style={styles.miniSemester}>{c.semester}</Text>
                  </View>
                  <Text style={styles.miniCourseName} numberOfLines={1}>{c.name}</Text>
                  <View style={styles.miniMeta}>
                    {(c.student_count ?? 0) > 0 && (
                      <View style={styles.miniMetaItem}>
                        <Ionicons name="people-outline" size={12} color={colors.neutral[400]} />
                        <Text style={styles.miniMetaText}>{c.student_count} student{c.student_count !== 1 ? 's' : ''}</Text>
                      </View>
                    )}
                    {(c.schedule_count ?? 0) > 0 && (
                      <View style={styles.miniMetaItem}>
                        <Ionicons name="calendar-outline" size={12} color={colors.neutral[400]} />
                        <Text style={styles.miniMetaText}>{c.schedule_count} session{c.schedule_count !== 1 ? 's' : ''}</Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        ) : null}

        {/* Today's Schedule */}
        {loading ? (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Today's Schedule</Text>
              <Text style={styles.dateLabel}>{todayStr}</Text>
            </View>
            <CardSkeleton />
            <CardSkeleton />
          </View>
        ) : todayLectures.length > 0 ? (
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
                    <Text style={styles.lectureTitle} numberOfLines={1}>{l.title}</Text>
                    <Text style={styles.lectureCourse} numberOfLines={1}>{l.courseName}</Text>
                    {l.location && (
                      <View style={styles.locationRow}>
                        <Ionicons name="location-outline" size={12} color={colors.neutral[400]} />
                        <Text style={styles.locationText} numberOfLines={1}>{l.location}</Text>
                      </View>
                    )}
                  </View>
                </View>
              </Card>
            ))}
          </View>
        ) : null}

        {/* Recent Grades */}
        {loading ? (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Recent Grades</Text>
            </View>
            <CardSkeleton />
            <CardSkeleton />
          </View>
        ) : recentGrades.length > 0 ? (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Recent Grades</Text>
              <TouchableOpacity onPress={() => navigation.navigate('Grades')}><Text style={styles.seeAll}>See All</Text></TouchableOpacity>
            </View>
            {recentGrades.map((g) => {
              const pct = g.max_score ? (g.score / g.max_score) * 100 : 0;
              const gradeColor = pct >= 75 ? colors.success[500] : pct >= 50 ? colors.warning[500] : colors.error[500];
              const gradeBg = pct >= 75 ? colors.success[50] : pct >= 50 ? colors.warning[50] : colors.error[50];
              return (
                <Card key={g.id} style={styles.gradeCard}>
                  <View style={styles.gradeLeft}>
                    <Text style={styles.gradeExam}>{g.exam_type}</Text>
                    <Text style={styles.gradeCourse}>{g.courseName}</Text>
                  </View>
                  <View style={[styles.gradeScoreBadge, { backgroundColor: gradeBg }]}>
                    <Text style={[styles.gradeScore, { color: gradeColor }]}>{g.score}{g.max_score ? `/${g.max_score}` : ''}</Text>
                  </View>
                </Card>
              );
            })}
          </View>
        ) : null}

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.quickActions}>
            {[
              { icon: 'book-outline', bg: colors.primary[50], color: colors.primary[600], label: 'My Courses', onPress: () => navigation.navigate('Courses') },
              { icon: 'add-circle-outline', bg: colors.secondary[50], color: colors.secondary[600], label: 'Join Course', onPress: () => navigation.navigate('JoinCourse') },
              { icon: 'calendar-outline', bg: colors.info[50], color: colors.info[600], label: 'Schedule', onPress: () => navigation.navigate('Schedule') },
              { icon: 'trophy-outline', bg: colors.accent[50], color: colors.accent[600], label: 'Grades', onPress: () => navigation.navigate('Grades') },
            ].map((a) => (
              <TouchableOpacity key={a.label} style={styles.quickActionBtn} onPress={a.onPress} activeOpacity={0.7}>
                <View style={[styles.quickActionIcon, { backgroundColor: a.bg }]}>
                  <Ionicons name={a.icon as any} size={18} color={a.color} />
                </View>
                <Text style={styles.quickActionText}>{a.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const makeStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.neutral[50] },
  content: { padding: spacing.lg, paddingBottom: spacing.massive },

  // Banners
  graceBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: isDark ? 'rgba(245,158,11,0.12)' : '#FFFBEB',
    borderWidth: 1,
    borderColor: isDark ? 'rgba(245,158,11,0.25)' : '#FDE68A',
    borderRadius: borderRadius.lg,
    marginBottom: spacing.lg,
  },
  graceBannerText: {
    ...typography.caption,
    color: isDark ? colors.warning[400] : colors.warning[700],
    flex: 1,
    lineHeight: 18,
  },
  expiredBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: isDark ? 'rgba(239,68,68,0.12)' : '#FEF2F2',
    borderWidth: 1,
    borderColor: isDark ? 'rgba(239,68,68,0.25)' : '#FEE2E2',
    borderRadius: borderRadius.lg,
    marginBottom: spacing.lg,
  },
  expiredBannerText: {
    ...typography.caption,
    color: isDark ? colors.error[400] : colors.error[700],
    flex: 1,
    lineHeight: 18,
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xxl,
    paddingTop: spacing.sm,
  },
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
    borderRadius: borderRadius.md,
    ...elevation.sm,
  },
  greeting: { ...typography.body, color: colors.neutral[500] },
  name: { ...typography.h2, color: colors.neutral[900], marginTop: spacing.xxs },
  notifBtn: {
    position: 'relative',
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.neutral[0],
    borderRadius: borderRadius.md,
    ...elevation.sm,
  },
  badge: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: colors.error[600],
    minWidth: 18,
    height: 18,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xxs,
  },
  badgeText: { ...typography.tiny, color: '#fff', fontWeight: '700' },

  // Overview Card
  overviewCard: {
    backgroundColor: colors.neutral[0],
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    marginBottom: spacing.xxl,
    ...elevation.md,
  },
  overviewTitle: {
    ...typography.h3,
    color: colors.neutral[800],
    marginBottom: spacing.lg,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'space-between',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: spacing.xs,
  },
  statIconBox: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  statValue: {
    ...typography.h2,
    color: colors.neutral[900],
    marginBottom: spacing.xxs,
  },
  statLabel: {
    ...typography.caption,
    color: colors.neutral[500],
  },

  // Section
  section: { marginBottom: spacing.xxl },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.h4,
    color: colors.neutral[800],
  },
  dateLabel: {
    ...typography.caption,
    color: colors.neutral[400],
  },
  seeAll: {
    ...typography.label,
    color: colors.primary[600],
  },

  // Mini Course Cards (dashboard)
  miniCourseCard: {
    backgroundColor: colors.neutral[0],
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    ...elevation.sm,
  },
  blockedMiniCard: {
    backgroundColor: isDark ? 'rgba(239,68,68,0.08)' : '#FEF2F2',
    borderColor: isDark ? 'rgba(239,68,68,0.2)' : '#FEE2E2',
    opacity: 0.8,
  },
  lockedMiniCard: {
    backgroundColor: isDark ? 'rgba(245,158,11,0.08)' : '#FFFBEB',
    borderColor: isDark ? 'rgba(245,158,11,0.2)' : '#FDE68A',
    opacity: 0.8,
  },
  miniCourseTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  miniCodeBox: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: borderRadius.xs,
    backgroundColor: colors.primary[50],
  },
  miniCodeText: {
    ...typography.tiny,
    color: colors.primary[700],
    fontWeight: '700',
  },
  blockedCodeBox: { backgroundColor: isDark ? 'rgba(239,68,68,0.15)' : '#FEE2E2' },
  blockedCodeText: { color: isDark ? colors.error[400] : colors.error[700] },
  lockedCodeBox: { backgroundColor: isDark ? 'rgba(245,158,11,0.15)' : '#FEF3C7' },
  lockedCodeText: { color: isDark ? colors.warning[400] : colors.warning[700] },
  miniSemester: {
    ...typography.tiny,
    color: colors.neutral[400],
  },
  miniCourseName: {
    ...typography.bodyMedium,
    color: colors.neutral[800],
    marginBottom: spacing.xs,
  },
  blockedLabel: {
    ...typography.tiny,
    color: isDark ? colors.error[400] : colors.error[600],
    fontWeight: '500',
  },
  lockedLabel: {
    ...typography.tiny,
    color: isDark ? colors.warning[400] : colors.warning[600],
    fontWeight: '500',
  },
  miniMeta: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  miniMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  miniMetaText: {
    ...typography.tiny,
    color: colors.neutral[400],
  },

  // Today's Schedule Cards
  lectureCard: {
    marginBottom: spacing.md,
  },
  lectureRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeCol: {
    width: 70,
    alignItems: 'center',
  },
  timeText: {
    ...typography.label,
    color: colors.primary[600],
  },
  timeSub: {
    ...typography.tiny,
    color: colors.neutral[400],
  },
  divider: {
    width: 3,
    height: 40,
    backgroundColor: colors.primary[200],
    borderRadius: borderRadius.xs,
    marginHorizontal: spacing.md,
  },
  lectureInfo: { flex: 1 },
  lectureTitle: {
    ...typography.bodyMedium,
    color: colors.neutral[900],
  },
  lectureCourse: {
    ...typography.caption,
    color: colors.neutral[500],
    marginTop: spacing.xxs,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xxs,
  },
  locationText: {
    ...typography.tiny,
    color: colors.neutral[400],
    marginLeft: spacing.xxs,
  },

  // Grade Cards
  gradeCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  gradeLeft: { flex: 1 },
  gradeExam: {
    ...typography.bodyMedium,
    color: colors.neutral[900],
  },
  gradeCourse: {
    ...typography.caption,
    color: colors.neutral[500],
    marginTop: spacing.xxs,
  },
  gradeScoreBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
  },
  gradeScore: {
    ...typography.bodyMedium,
    fontWeight: '700',
  },

  // Quick Actions
  quickActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  quickActionBtn: {
    flex: 1,
    minWidth: '47%',
    backgroundColor: colors.neutral[0],
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    alignItems: 'center',
    ...elevation.sm,
  },
  quickActionIcon: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  quickActionText: {
    ...typography.caption,
    color: colors.neutral[600],
    textAlign: 'center',
  },
});
