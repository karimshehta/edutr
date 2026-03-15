import React, { useEffect, useState, useCallback, useMemo} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { supabase } from '../../lib/supabase';
import { Card, Badge, Button, EmptyState, Avatar, StudentsListSkeleton } from '../../components';
import { colors, spacing, typography, borderRadius } from '../../theme';
import { UserProfile, Enrollment } from '../../types';
import { formatDate } from '../../lib/helpers';
import { useTheme } from '../../contexts/ThemeContext';

interface StudentItem extends UserProfile {
  enrollment: Enrollment;
}

export function ProfStudents({ route }: any) {

  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors, isDark), [colors, isDark]);
  const { courseId } = route.params;
  const { profile } = useAuth();
  const { showToast } = useToast();
  const [students, setStudents] = useState<StudentItem[]>([]);
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [blockFilter, setBlockFilter] = useState<'all' | 'blocked'>('all');
  const [blockingId, setBlockingId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const loadStudents = useCallback(async () => {
    const { data: enrollments } = await supabase
      .from('enrollments')
      .select('*')
      .eq('course_id', courseId);

    const ids = (enrollments || []).map((e) => e.student_id);
    if (ids.length === 0) {
      setStudents([]);
      return;
    }

    const { data: profiles } = await supabase
      .from('user_profiles')
      .select('*')
      .in('id', ids);

    const items: StudentItem[] = (profiles || []).map((p) => ({
      ...p,
      enrollment: enrollments!.find((e) => e.student_id === p.id)!,
    }));
    setStudents(items.sort((a, b) => (a.last_name || '').localeCompare(b.last_name || '')));
    setLoading(false);
  }, [courseId]);

  useEffect(() => {
    loadStudents();
  }, [loadStudents]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadStudents();
    setRefreshing(false);
  };

  const toggleBlock = async (student: StudentItem) => {
    if (blockingId) return; // Prevent multiple clicks
    
    setBlockingId(student.id);
    const isBlocked = student.enrollment.is_blocked;
    
    try {
      if (isBlocked) {
        // Unblock - order matters: delete from blocked_students first
        const { error: blockedDeleteError } = await supabase
          .from('blocked_students')
          .delete()
          .eq('course_id', courseId)
          .eq('student_id', student.id);
        
        if (blockedDeleteError) {
          console.error('Error deleting from blocked_students:', blockedDeleteError);
          throw blockedDeleteError;
        }

        const { error: enrollmentUpdateError } = await supabase
          .from('enrollments')
          .update({ is_blocked: false, blocked_at: null, blocked_by: null })
          .eq('course_id', courseId)
          .eq('student_id', student.id);

        if (enrollmentUpdateError) {
          console.error('Error updating enrollment:', enrollmentUpdateError);
          throw enrollmentUpdateError;
        }

        showToast(`Unblocked ${student.first_name} ${student.last_name}`);
      } else {
        // Block - order matters: update enrollment first
        const { error: enrollmentUpdateError } = await supabase
          .from('enrollments')
          .update({
            is_blocked: true,
            blocked_at: new Date().toISOString(),
            blocked_by: profile!.id,
          })
          .eq('course_id', courseId)
          .eq('student_id', student.id);

        if (enrollmentUpdateError) {
          console.error('Error updating enrollment for block:', enrollmentUpdateError);
          throw enrollmentUpdateError;
        }

        const { error: blockedInsertError } = await supabase.from('blocked_students').insert({
          student_id: student.id,
          course_id: courseId,
          instructor_id: profile!.id,
        });

        if (blockedInsertError) {
          console.error('Error inserting into blocked_students:', blockedInsertError);
          // Rollback enrollment update
          await supabase
            .from('enrollments')
            .update({ is_blocked: false, blocked_at: null, blocked_by: null })
            .eq('course_id', courseId)
            .eq('student_id', student.id);
          throw blockedInsertError;
        }

        showToast(`Blocked ${student.first_name} ${student.last_name}`, 'error');
      }
      await loadStudents();
    } catch (error: any) {
      console.error('Block/Unblock operation failed:', error);
      showToast(error.message || 'Operation failed', 'error');
    } finally {
      setBlockingId(null);
    }
  };

  // Mirrors web confirmRemoveStudent exactly:
  // supabase.from('enrollments').delete().eq('course_id', courseId).eq('student_id', studentId)
  // if (error) throw error; then reload list
  const removeStudent = async (student: StudentItem) => {
    if (removingId) return;

    setRemovingId(student.id);

    try {
      const { error } = await supabase
        .from('enrollments')
        .delete()
        .eq('course_id', courseId)
        .eq('student_id', student.id);

      if (error) throw error;

      // Optimistically remove from local state immediately (matches web pattern)
      setStudents((prev) => prev.filter((s) => s.id !== student.id));
      showToast(`Removed ${student.first_name} ${student.last_name}`);
    } catch (err: any) {
      showToast(err.message || 'Failed to remove student', 'error');
    } finally {
      setRemovingId(null);
    }
  };

  const filtered = students.filter((s) => {
    // Apply block filter first (match web logic)
    if (blockFilter === 'blocked' && !s.enrollment.is_blocked) return false;
    
    // Then apply search filter
    const q = search.toLowerCase();
    return (
      (s.first_name || '').toLowerCase().includes(q) ||
      (s.last_name || '').toLowerCase().includes(q) ||
      (s.email || '').toLowerCase().includes(q)
    );
  });

  return (
    <View style={styles.container}>
      <View style={styles.filtersContainer}>
        <View style={styles.searchContainer}>
          <Ionicons name="search-outline" size={18} color={colors.neutral[400]} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search students..."
            value={search}
            onChangeText={setSearch}
            placeholderTextColor={colors.neutral[400]}
          />
        </View>
        
        {/* Filter Toggle Buttons */}
        <View style={styles.filterToggle}>
          <TouchableOpacity
            style={[styles.filterButton, blockFilter === 'all' && styles.filterButtonAll]}
            onPress={() => setBlockFilter('all')}
            activeOpacity={0.7}
          >
            <Ionicons
              name="people-outline"
              size={13}
              color={blockFilter === 'all' ? '#FFFFFF' : colors.neutral[500]}
            />
            <Text style={[styles.filterButtonText, blockFilter === 'all' && styles.filterButtonTextAll]}>
              All
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterButton, blockFilter === 'blocked' && styles.filterButtonBlocked]}
            onPress={() => setBlockFilter('blocked')}
            activeOpacity={0.7}
          >
            <Ionicons
              name="ban-outline"
              size={13}
              color={blockFilter === 'blocked' ? '#FFFFFF' : colors.neutral[500]}
            />
            <Text style={[styles.filterButtonText, blockFilter === 'blocked' && styles.filterButtonTextBlocked]}>
              Blocked
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          loading ? <StudentsListSkeleton /> : <EmptyState icon="people-outline" title="No Students" message="No students enrolled yet." />
        }
        renderItem={({ item }) => {
          const isBlocking = blockingId === item.id;
          const isRemoving = removingId === item.id;
          
          return (
            <Card style={styles.studentCard}>
              <View style={styles.studentRow}>
                {/* Avatar */}
                <Avatar
                  firstName={item.first_name}
                  lastName={item.last_name}
                  avatarUrl={item.avatar_url}
                  size={42}
                />

                {/* Name + email + blocked badge */}
                <View style={styles.studentInfo}>
                  <Text style={styles.studentName}>
                    {item.first_name} {item.last_name}
                  </Text>
                  <Text style={styles.studentEmail}>{item.email}</Text>
                  {item.enrollment.is_blocked && (
                    <Badge text="Blocked" variant="error" style={{ alignSelf: 'flex-start', marginTop: 3 }} />
                  )}
                </View>

                {/* Action icons — right side */}
                <View style={styles.studentActions}>
                  {/* Block / Unblock */}
                  <TouchableOpacity
                    style={[
                      styles.iconActionBtn,
                      item.enrollment.is_blocked ? styles.iconActionBtnSuccess : styles.iconActionBtnDanger,
                      (isBlocking || isRemoving) && styles.iconActionBtnDisabled,
                    ]}
                    onPress={() => toggleBlock(item)}
                    disabled={isBlocking || isRemoving}
                    hitSlop={{ top: 8, bottom: 8, left: 6, right: 4 }}
                  >
                    <Ionicons
                      name={
                        isBlocking
                          ? 'hourglass-outline'
                          : item.enrollment.is_blocked
                            ? 'checkmark-circle'
                            : 'ban'
                      }
                      size={20}
                      color={item.enrollment.is_blocked ? colors.success[600] : colors.error[600]}
                    />
                  </TouchableOpacity>

                  {/* Remove (trash) */}
                  <TouchableOpacity
                    style={[
                      styles.iconActionBtn,
                      styles.iconActionBtnGhost,
                      (isBlocking || isRemoving) && styles.iconActionBtnDisabled,
                    ]}
                    onPress={() => removeStudent(item)}
                    disabled={isBlocking || isRemoving}
                    hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }}
                  >
                    <Ionicons
                      name={isRemoving ? 'hourglass-outline' : 'trash-outline'}
                      size={18}
                      color={colors.error[400]}
                    />
                  </TouchableOpacity>
                </View>
              </View>
            </Card>
          );
        }}
      />
    </View>
  );
}

const makeStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.neutral[50] },
  filtersContainer: {
    flexDirection: 'row',
    margin: spacing.md,
    marginBottom: 0,
    gap: spacing.sm,
  },
  searchContainer: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.neutral[0],
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
  pickerContainer: {
    flex: 1,
    backgroundColor: colors.neutral[0],
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    justifyContent: 'center',
  },
  picker: {
    height: 48,
  },
  filterToggle: {
    flexDirection: 'row',
    backgroundColor: colors.neutral[100],
    borderRadius: borderRadius.md,
    padding: 3,
    gap: 3,
  },
  filterButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: borderRadius.sm,
    backgroundColor: 'transparent',
  },
  // "All" tab active state — primary brand teal
  filterButtonAll: {
    backgroundColor: colors.primary[600],
    shadowColor: colors.primary[900],
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  // "Blocked" tab active state — error red for semantic clarity
  filterButtonBlocked: {
    backgroundColor: colors.error[600],
    shadowColor: colors.error[900],
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  filterButtonText: {
    ...typography.captionMedium,
    color: colors.neutral[500],
  },
  // Active text for "All"
  filterButtonTextAll: {
    color: '#FFFFFF',
  },
  // Active text for "Blocked"
  filterButtonTextBlocked: {
    color: '#FFFFFF',
  },
  searchInput: { flex: 1, ...typography.body, color: colors.neutral[900], paddingVertical: 12, marginLeft: spacing.sm },
  list: { padding: spacing.md, paddingBottom: spacing.xxl },
  studentCard: { marginBottom: spacing.sm },
  studentRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  studentInfo: { flex: 1, marginLeft: spacing.sm },
  studentName: { ...typography.bodyMedium, color: colors.neutral[800] },
  studentEmail: { ...typography.caption, color: colors.neutral[400], marginTop: 1 },
  studentActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: spacing.xs,
    flexShrink: 0,
  },
  actions: { flexDirection: 'row' },
  // Icon-only action buttons (block / trash)
  iconActionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.xs,
  },
  iconActionBtnDanger: {
    backgroundColor: colors.error[50],
  },
  iconActionBtnSuccess: {
    backgroundColor: colors.success[50],
  },
  iconActionBtnGhost: {
    backgroundColor: colors.neutral[100],
  },
  iconActionBtnDisabled: {
    opacity: 0.45,
  },
});
