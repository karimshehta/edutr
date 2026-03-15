import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, RefreshControl, TouchableOpacity, Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { supabase } from '../../lib/supabase';
import { Card, Badge, ListSkeleton } from '../../components';
import { colors, spacing, typography, borderRadius } from '../../theme';
import { Course } from '../../types';
import { useTheme } from '../../contexts/ThemeContext';

type CourseWithStatus = Course & { is_blocked?: boolean; is_locked?: boolean };

const CourseCard = React.memo(({
  item,
  onPress,
  onLeave,
  isLeaving,
  styles,
  themeColors,
}: {
  item: CourseWithStatus;
  onPress: () => void;
  onLeave: () => void;
  isLeaving: boolean;
  styles: ReturnType<typeof makeStyles>;
  themeColors: any;
}) => {
  const prof = item.user_profiles;
  const profName = prof ? `${prof.first_name || ''} ${prof.last_name || ''}`.trim() : 'Unknown';

  if (item.is_locked) {
    return (
      <Card style={[styles.courseCard, styles.lockedCourseCard]} onPress={onPress}>
        <View style={styles.lockedOverlay}>
          <View style={styles.courseHeader}>
            <View style={[styles.codeBox, styles.lockedCodeBox]}>
              <Text style={[styles.codeText, styles.lockedCodeText]}>{item.code}</Text>
            </View>
            <View style={styles.headerRight}>
              <View style={styles.lockedBadge}>
                <Ionicons name="lock-closed" size={12} color={themeColors.warning[600]} />
                <Text style={styles.lockedBadgeText}>Unavailable</Text>
              </View>
            </View>
          </View>
          <Text style={[styles.courseName, styles.lockedText]}>{item.name}</Text>
          <View style={styles.metaRow}>
            <Ionicons name="person-outline" size={14} color={themeColors.neutral[300]} />
            <Text style={[styles.metaText, styles.lockedMetaText]}>{profName}</Text>
          </View>
          {item.department && (
            <View style={styles.metaRow}>
              <Ionicons name="business-outline" size={14} color={themeColors.neutral[300]} />
              <Text style={[styles.metaText, styles.lockedMetaText]}>{item.department}</Text>
            </View>
          )}
        </View>
      </Card>
    );
  }

  return (
    <Card
      style={[styles.courseCard, item.is_blocked && styles.blockedCourseCard]}
      onPress={onPress}
    >
      <View style={styles.courseHeader}>
        <View style={styles.codeBox}><Text style={styles.codeText}>{item.code}</Text></View>
        <View style={styles.headerRight}>
          {item.is_blocked && <Badge text="Blocked" variant="error" />}
          {item.semester && !item.is_blocked ? <Badge text={item.semester} variant="info" /> : null}
          {!item.is_blocked && (
            <TouchableOpacity
              onPress={onLeave}
              style={[styles.leaveIconBtn, isLeaving && styles.leaveIconBtnDisabled]}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              disabled={isLeaving}
            >
              <Ionicons
                name={isLeaving ? "hourglass" : "log-out-outline"}
                size={18}
                color={themeColors.neutral[400]}
              />
            </TouchableOpacity>
          )}
        </View>
      </View>
      <Text style={styles.courseName}>{item.name}</Text>
      <View style={styles.metaRow}>
        <Ionicons name="person-outline" size={14} color={themeColors.neutral[400]} />
        <Text style={styles.metaText}>{profName}</Text>
      </View>
      {item.department && (
        <View style={styles.metaRow}>
          <Ionicons name="business-outline" size={14} color={themeColors.neutral[400]} />
          <Text style={styles.metaText}>{item.department}</Text>
        </View>
      )}
    </Card>
  );
});

export function StudentCourses({ navigation }: any) {

  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors, isDark), [colors, isDark]);
  const { profile } = useAuth();
  const { showToast } = useToast();
  const [courses, setCourses] = useState<CourseWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [leavingId, setLeavingId] = useState<string | null>(null);

  const loadCourses = useCallback(async () => {
    if (!profile) return;
    const { data: enrollments } = await supabase
      .from('enrollments').select('course_id, is_blocked').eq('student_id', profile.id);
    const ids = enrollments?.map((e) => e.course_id) || [];
    if (ids.length > 0) {
      const { data } = await supabase
        .from('courses').select('*, user_profiles!courses_created_by_fkey(first_name, last_name)')
        .in('id', ids).eq('is_active', true).order('name');
      const coursesWithStatus = (data || []).map((course) => {
        const enrollment = enrollments!.find((e) => e.course_id === course.id);
        return {
          ...course,
          is_blocked: enrollment?.is_blocked || false,
          is_locked: course.is_plan_locked === true,
        };
      });
      setCourses(coursesWithStatus);
    } else {
      setCourses([]);
    }
    setLoading(false);
  }, [profile]);

  useFocusEffect(useCallback(() => { loadCourses(); }, [loadCourses]));
  const onRefresh = async () => { setRefreshing(true); await loadCourses(); setRefreshing(false); };

  const handleLeaveCourse = useCallback(async (course: CourseWithStatus) => {
    if (leavingId) return;

    setLeavingId(course.id);

    try {
      const { error } = await supabase.from('enrollments').delete()
        .eq('course_id', course.id).eq('student_id', profile!.id);

      if (error) {
        showToast('Failed to leave course', 'error');
      } else {
        showToast(`Left "${course.name}"`);
        await loadCourses();
      }
    } catch (error: any) {
      showToast(error.message || 'Failed to leave course', 'error');
    } finally {
      setLeavingId(null);
    }
  }, [leavingId, profile, showToast, loadCourses]);

  const handleCoursePress = useCallback((item: CourseWithStatus) => {
    if (item.is_locked) {
      Alert.alert(
        'Course Unavailable',
        'This course is not available at the moment. Please contact your instructor for more details.',
        [{ text: 'OK' }]
      );
      return;
    }
    navigation.navigate('CourseDetail', { courseId: item.id, courseName: item.name });
  }, [navigation]);

  const renderCourse = useCallback(({ item }: { item: CourseWithStatus }) => (
    <CourseCard
      item={item}
      onPress={() => handleCoursePress(item)}
      onLeave={() => handleLeaveCourse(item)}
      isLeaving={leavingId === item.id}
      styles={styles}
      themeColors={colors}
    />
  ), [handleCoursePress, handleLeaveCourse, leavingId, styles, colors]);

  const keyExtractor = useCallback((item: Course) => item.id, []);

  const emptyComponent = useMemo(() => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconWrap}>
        <Ionicons name="school-outline" size={48} color={colors.neutral[300]} />
      </View>
      <Text style={styles.emptyTitle}>No courses yet</Text>
      <Text style={styles.emptyMessage}>
        Join your first course using the course code provided by your professor
      </Text>
      <TouchableOpacity
        style={styles.emptyButton}
        onPress={() => navigation.navigate('Dashboard', { screen: 'JoinCourse' })}
      >
        <Ionicons name="add-circle-outline" size={18} color={colors.primary[600]} />
        <Text style={styles.emptyButtonText} numberOfLines={1}>Join Course</Text>
      </TouchableOpacity>
    </View>
  ), [navigation]);

  if (loading) {
    return (
      <View style={styles.container}>
        <ListSkeleton count={4} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={courses}
        keyExtractor={keyExtractor}
        renderItem={renderCourse}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={emptyComponent}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={10}
        removeClippedSubviews={true}
      />
    </View>
  );
}

const makeStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.neutral[50] },
  list: { padding: spacing.md, paddingBottom: spacing.xxl },
  courseCard: { marginBottom: spacing.sm },
  blockedCourseCard: { backgroundColor: isDark ? 'rgba(239,68,68,0.12)' : '#FEF2F2', borderColor: isDark ? 'rgba(239,68,68,0.25)' : '#FEE2E2', borderWidth: 1 },
  lockedCourseCard: { backgroundColor: isDark ? 'rgba(245,158,11,0.08)' : '#FFFBEB', borderColor: isDark ? 'rgba(245,158,11,0.2)' : '#FDE68A', borderWidth: 1 },
  lockedOverlay: { opacity: 0.6 },
  courseHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  codeBox: { backgroundColor: colors.primary[50], paddingHorizontal: 10, paddingVertical: 4, borderRadius: borderRadius.sm },
  codeText: { ...typography.captionMedium, color: colors.primary[700], fontWeight: '700' },
  lockedCodeBox: { backgroundColor: isDark ? 'rgba(245,158,11,0.15)' : '#FEF3C7' },
  lockedCodeText: { color: isDark ? colors.warning[400] : colors.warning[700] },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  lockedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: borderRadius.sm, backgroundColor: isDark ? 'rgba(245,158,11,0.15)' : '#FEF3C7' },
  lockedBadgeText: { ...typography.tiny, color: isDark ? colors.warning[400] : colors.warning[700], fontWeight: '600' },
  leaveIconBtn: {
    width: 32, height: 32, borderRadius: 8, backgroundColor: colors.neutral[50],
    alignItems: 'center', justifyContent: 'center',
  },
  leaveIconBtnDisabled: {
    opacity: 0.5,
  },
  courseName: { ...typography.h3, color: colors.neutral[800], marginBottom: spacing.xs },
  lockedText: { color: colors.neutral[500] },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  metaText: { ...typography.caption, color: colors.neutral[500], marginLeft: 6 },
  lockedMetaText: { color: colors.neutral[400] },

  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl * 2,
    paddingHorizontal: spacing.lg,
  },
  emptyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.neutral[100],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  emptyTitle: {
    ...typography.h3,
    color: colors.neutral[700],
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  emptyMessage: {
    ...typography.body,
    color: colors.neutral[400],
    textAlign: 'center',
    marginBottom: spacing.lg,
    lineHeight: 22,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    borderColor: colors.primary[600],
    backgroundColor: colors.primary[50],
  },
  emptyButtonText: {
    ...typography.button,
    color: colors.primary[600],
    fontSize: 14,
    fontWeight: '600',
  },
});
