import React, { useState, useCallback, useMemo} from 'react';
import {
  View, Text, StyleSheet, FlatList, RefreshControl, TouchableOpacity, Modal,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { supabase } from '../../lib/supabase';
import { Card, Badge, EmptyState, ListSkeleton } from '../../components';
import { colors, spacing, typography, borderRadius } from '../../theme';
import { Course } from '../../types';
import { useTheme } from '../../contexts/ThemeContext';

export function ProfessorCourses({ navigation }: any) {

  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors, isDark), [colors, isDark]);
  const { profile } = useAuth();
  const { showToast } = useToast();
  const [courses, setCourses] = useState<(Course & { studentCount: number; isLocked?: boolean })[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [courseToDelete, setCourseToDelete] = useState<Course | null>(null);
  const [maxCourses, setMaxCourses] = useState<number | null>(null);

  const loadCourses = useCallback(async () => {
    if (!profile) return;
    const effectivePlan = profile.plan || 'free';

    const [{ data: assignments }, { data: planData }] = await Promise.all([
      supabase.from('course_assignments').select('course_id').eq('user_id', profile.id),
      supabase.from('plan_settings').select('max_courses').eq('plan_name', effectivePlan).maybeSingle(),
    ]);

    const limit: number | null = planData?.max_courses ?? null;
    setMaxCourses(limit);

    const { data: created } = await supabase.from('courses').select('id').eq('created_by', profile.id);
    const allIds = [...new Set([...(assignments?.map((a: any) => a.course_id) || []), ...(created?.map((c: any) => c.id) || [])])];
    if (allIds.length > 0) {
      const { data: courseData } = await supabase.from('courses').select('*').in('id', allIds).order('created_at', { ascending: true });
      const enriched = await Promise.all((courseData || []).map(async (c: any, index: number) => {
        const { count } = await supabase.from('enrollments').select('id', { count: 'exact', head: true }).eq('course_id', c.id);
        const isLocked = limit !== null && index >= limit;
        return { ...c, studentCount: count || 0, isLocked };
      }));
      setCourses(enriched);
    } else {
      setCourses([]);
    }
    setLoading(false);
  }, [profile]);

  useFocusEffect(useCallback(() => { loadCourses(); }, [loadCourses]));
  const onRefresh = async () => { setRefreshing(true); await loadCourses(); setRefreshing(false); };

  const handleDeleteCourse = (course: Course) => {
    setCourseToDelete(course);
  };

  const confirmDelete = async () => {
    if (!courseToDelete) return;
    const course = courseToDelete;
    setCourseToDelete(null);
    try {
      const { error } = await supabase.from('courses').delete().eq('id', course.id);
      if (error) throw error;
      setCourses(courses.filter(c => c.id !== course.id));
      showToast('Course deleted successfully');
    } catch (err: any) {
      showToast('Failed to delete course', 'error');
    }
  };

  const renderCourse = ({ item }: { item: Course & { studentCount: number; isLocked?: boolean } }) => (
    <Card style={[styles.courseCard, item.isLocked && styles.lockedCard]} onPress={() => navigation.navigate('ProfCourseDetail', { courseId: item.id, courseName: item.name })}>
      <View style={styles.cardHeader}>
        <View style={styles.codeBox}><Text style={styles.codeText}>{item.code}</Text></View>
        <View style={styles.headerRight}>
          {item.isLocked
            ? <View style={styles.lockedBadge}><Ionicons name="lock-closed" size={12} color={colors.warning[600]} /><Text style={styles.lockedBadgeText}>Locked</Text></View>
            : <Badge text={item.is_active ? 'Active' : 'Inactive'} variant={item.is_active ? 'success' : 'neutral'} />
          }
          <TouchableOpacity
            onPress={() => handleDeleteCourse(item)}
            style={styles.deleteIconBtn}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="trash-outline" size={16} color={colors.neutral[400]} />
          </TouchableOpacity>
        </View>
      </View>
      <Text style={styles.courseName}>{item.name}</Text>
      {item.isLocked && <Text style={styles.upgradeHint}>Upgrade to Pro to unlock this course.</Text>}
      {item.department && <Text style={styles.dept}>{item.department}</Text>}
      <View style={styles.metaRow}>
        <View style={styles.metaItem}>
          <Ionicons name="people-outline" size={14} color={colors.neutral[400]} />
          <Text style={styles.metaText}>{item.studentCount} students</Text>
        </View>
        {item.semester && (
          <View style={styles.metaItem}>
            <Ionicons name="calendar-outline" size={14} color={colors.neutral[400]} />
            <Text style={styles.metaText}>{item.semester}</Text>
          </View>
        )}
      </View>
    </Card>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={courses}
        keyExtractor={(item) => item.id}
        renderItem={renderCourse}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={loading ? <ListSkeleton count={4} /> : <EmptyState icon="book-outline" title="No Courses" message="Create your first course to get started." />}
        ListHeaderComponent={
          <>
            <TouchableOpacity style={styles.createBtn} onPress={() => navigation.navigate('CreateCourse')} activeOpacity={0.8}>
              <Ionicons name="add-circle" size={22} color="#fff" />
              <Text style={styles.createBtnText}>Create New Course</Text>
            </TouchableOpacity>
            {maxCourses !== null && courses.some((c: any) => c.isLocked) && (
              <View style={styles.lockedBanner}>
                <Ionicons name="lock-closed" size={16} color={colors.warning[600]} />
                <Text style={styles.lockedBannerText}>
                  Your plan allows up to {maxCourses} active course{maxCourses !== 1 ? 's' : ''}. Upgrade to Pro to unlock all courses.
                </Text>
              </View>
            )}
          </>
        }
      />

      {/* Delete Confirmation Modal */}
      <Modal
        visible={!!courseToDelete}
        transparent
        animationType="fade"
        onRequestClose={() => setCourseToDelete(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalIconWrap}>
              <Ionicons name="trash-outline" size={28} color={colors.error[500]} />
            </View>
            <Text style={styles.modalTitle}>Delete Course?</Text>
            <Text style={styles.modalMessage}>
              {`Are you sure you want to delete "${courseToDelete?.name}"? This will permanently remove all data and cannot be undone.`}
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setCourseToDelete(null)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalDeleteBtn} onPress={confirmDelete}>
                <Text style={styles.modalDeleteText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const makeStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.neutral[50] },
  list: { padding: spacing.md, paddingBottom: spacing.xxl },
  createBtn: {
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center',
    backgroundColor: colors.primary[600],
    borderRadius: borderRadius.xl,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginBottom: spacing.md, 
    gap: spacing.sm,
    alignSelf: 'flex-start', // Make button inline (not full width)
  },
  createBtnText: { ...typography.button, color: '#fff' },
  courseCard: { marginBottom: spacing.sm },
  lockedCard: { opacity: 0.75, borderColor: colors.warning[300], borderWidth: 1.5 },
  lockedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.warning[50], paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  lockedBadgeText: { ...typography.caption, color: colors.warning[700], fontWeight: '600', fontSize: 11 },
  upgradeHint: { ...typography.caption, color: colors.warning[600], marginBottom: spacing.xs, fontSize: 12 },
  lockedBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, backgroundColor: colors.warning[50], borderRadius: 12, padding: spacing.md, marginHorizontal: spacing.md, marginTop: spacing.md, borderWidth: 1, borderColor: colors.warning[200] },
  lockedBannerText: { ...typography.caption, color: colors.warning[800], flex: 1 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  codeBox: { backgroundColor: colors.primary[50], paddingHorizontal: 10, paddingVertical: 4, borderRadius: borderRadius.sm },
  codeText: { ...typography.captionMedium, color: colors.primary[700], fontWeight: '700' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  deleteIconBtn: {
    width: 32, height: 32, borderRadius: 8, backgroundColor: colors.neutral[50],
    alignItems: 'center', justifyContent: 'center',
  },
  courseName: { ...typography.h3, color: colors.neutral[800], marginBottom: 4 },
  dept: { ...typography.caption, color: colors.neutral[400], marginBottom: spacing.sm },
  metaRow: { flexDirection: 'row', gap: spacing.md },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { ...typography.caption, color: colors.neutral[500] },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  modalCard: {
    backgroundColor: colors.neutral[0],
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 12,
  },
  modalIconWrap: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.full,
    backgroundColor: colors.error[50],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  modalTitle: {
    ...typography.h3,
    color: colors.neutral[900],
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  modalMessage: {
    ...typography.body,
    color: colors.neutral[500],
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.xl,
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    width: '100%',
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: borderRadius.md,
    backgroundColor: colors.neutral[100],
    alignItems: 'center',
  },
  modalCancelText: {
    ...typography.bodyMedium,
    color: colors.neutral[700],
  },
  modalDeleteBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: borderRadius.md,
    backgroundColor: colors.error[500],
    alignItems: 'center',
  },
  modalDeleteText: {
    ...typography.bodyMedium,
    color: '#fff',
  },
});
