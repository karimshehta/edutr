import React, { useState, useCallback, useMemo} from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Share,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { supabase } from '../../lib/supabase';
import { Card, Badge, EmptyState, Button } from '../../components';
import { colors, spacing, typography, borderRadius } from '../../theme';
import { Course } from '../../types';
import { useTheme } from '../../contexts/ThemeContext';

export function ProfCourseDetail({ route, navigation }: any) {

  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors, isDark), [colors, isDark]);
  const { courseId, courseName } = route.params;
  const { profile } = useAuth();
  const { showToast } = useToast();
  const [course, setCourse] = useState<Course | null>(null);
  const [studentCount, setStudentCount] = useState(0);
  const [lectureCount, setLectureCount] = useState(0);
  const [pendingObjections, setPendingObjections] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    const { data } = await supabase.from('courses').select('*').eq('id', courseId).maybeSingle();
    setCourse(data);
    const { count: sc } = await supabase.from('enrollments').select('id', { count: 'exact', head: true }).eq('course_id', courseId);
    setStudentCount(sc || 0);
    const { count: lc } = await supabase.from('lectures').select('id', { count: 'exact', head: true }).eq('course_id', courseId);
    setLectureCount(lc || 0);
    const { count: oc } = await supabase.from('grade_objections').select('id', { count: 'exact', head: true }).eq('course_id', courseId).eq('status', 'pending');
    setPendingObjections(oc || 0);
  }, [courseId]);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));
  const onRefresh = async () => { setRefreshing(true); await loadData(); setRefreshing(false); };

  const shareCourseCode = async () => {
    if (!course) return;
    await Share.share({ message: `Join my course "${course.name}" on EduTracker! Use code: ${course.code}` });
  };

  const menuItems = [
    { icon: 'people-outline', label: 'Students', subtitle: `${studentCount} enrolled`, color: colors.primary[500], bg: colors.primary[50], onPress: () => navigation.navigate('ProfStudents', { courseId, courseName }) },
    { icon: 'calendar-outline', label: 'Schedule', subtitle: `${lectureCount} lectures`, color: colors.secondary[500], bg: colors.secondary[50], onPress: () => navigation.navigate('ManageSchedule', { courseId, courseName }) },
    { icon: 'document-text-outline', label: 'Materials', subtitle: 'Upload & manage files', color: colors.accent[500], bg: colors.accent[50], onPress: () => navigation.navigate('ProfMaterials', { courseId, courseName }) },
    { icon: 'hand-left-outline', label: 'Attendance', subtitle: 'Sessions & records', color: colors.success[500], bg: colors.success[50], onPress: () => navigation.navigate('ProfAttendance', { courseId, courseName }) },
    { icon: 'school-outline', label: 'Grades', subtitle: 'View published grades', color: colors.info[500], bg: colors.info[50], onPress: () => navigation.navigate('ProfGrades', { courseId, courseName }) },
    { icon: 'flag-outline', label: 'Objections', subtitle: `${pendingObjections} pending`, color: colors.warning[500], bg: colors.warning[50], onPress: () => navigation.navigate('ProfObjections', { courseId, courseName }) },
    { icon: 'megaphone-outline', label: 'Announcement', subtitle: 'Notify students', color: colors.error[500], bg: colors.error[50], onPress: () => navigation.navigate('SendAnnouncement', { courseId, courseName }) },
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
      {course && (
        <Card style={styles.headerCard}>
          <View style={styles.headerTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.courseNameText}>{course.name}</Text>
              {course.department && <Text style={styles.dept}>{course.department}</Text>}
            </View>
            <Badge text={course.is_active ? 'Active' : 'Inactive'} variant={course.is_active ? 'success' : 'neutral'} />
          </View>
          <TouchableOpacity style={styles.codeRow} onPress={shareCourseCode}>
            <View style={styles.codeBox}>
              <Text style={styles.codeLabel}>Course Code</Text>
              <Text style={styles.codeValue}>{course.code}</Text>
            </View>
            <View style={styles.shareBtn}>
              <Ionicons name="share-outline" size={20} color={colors.primary[500]} />
            </View>
          </TouchableOpacity>
        </Card>
      )}

      <View style={styles.menuGrid}>
        {menuItems.map((item) => (
          <TouchableOpacity key={item.label} style={styles.menuItem} onPress={item.onPress} activeOpacity={0.7}>
            <View style={[styles.menuIcon, { backgroundColor: item.bg }]}>
              <Ionicons name={item.icon} size={24} color={item.color} />
            </View>
            <View style={styles.menuText}>
              <Text style={styles.menuLabel}>{item.label}</Text>
              <Text style={styles.menuSubtitle}>{item.subtitle}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.neutral[300]} />
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}

const makeStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.neutral[50] },
  content: { padding: spacing.md, paddingBottom: spacing.xxl },
  headerCard: { marginBottom: spacing.md },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.md },
  courseNameText: { ...typography.h2, color: colors.neutral[900] },
  dept: { ...typography.caption, color: colors.neutral[400], marginTop: 2 },
  codeRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.primary[50], borderRadius: borderRadius.md, padding: spacing.md },
  codeBox: { flex: 1 },
  codeLabel: { ...typography.small, color: colors.primary[400] },
  codeValue: { ...typography.h2, color: colors.primary[700], letterSpacing: 3 },
  shareBtn: { padding: spacing.sm },
  menuGrid: {
    backgroundColor: colors.neutral[0], borderRadius: borderRadius.lg, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
    marginBottom: spacing.lg,
  },
  menuItem: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.neutral[50] },
  menuIcon: { width: 44, height: 44, borderRadius: borderRadius.md, alignItems: 'center', justifyContent: 'center', marginRight: spacing.md },
  menuText: { flex: 1 },
  menuLabel: { ...typography.bodyMedium, color: colors.neutral[800] },
  menuSubtitle: { ...typography.small, color: colors.neutral[400], marginTop: 1 },
});
