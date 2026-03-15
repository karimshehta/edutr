import React, { useState, useCallback, useMemo} from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Share, Alert, Modal, TextInput,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { supabase } from '../../lib/supabase';
import { Card, Badge, EmptyState, Button, Input } from '../../components';
import { colors, spacing, typography, borderRadius } from '../../theme';
import { Course } from '../../types';
import { useTheme } from '../../contexts/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export function ProfCourseDetail({ route, navigation }: any) {

  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors, isDark), [colors, isDark]);
  const insets = useSafeAreaInsets();
  const { courseId, courseName } = route.params;
  const { profile } = useAuth();
  const { showToast } = useToast();
  const [course, setCourse] = useState<Course | null>(null);
  const [studentCount, setStudentCount] = useState(0);
  const [lectureCount, setLectureCount] = useState(0);
  const [pendingObjections, setPendingObjections] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [togglingActive, setTogglingActive] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDepartment, setEditDepartment] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editSemester, setEditSemester] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

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

  const openEditModal = () => {
    if (!course) return;
    setEditName(course.name);
    setEditDepartment(course.department || '');
    setEditDescription((course as any).description || '');
    setEditSemester(course.semester || '');
    setShowEditModal(true);
  };

  const saveCourseEdit = async () => {
    if (!editName.trim() || savingEdit) return;
    setSavingEdit(true);
    const { error } = await supabase
      .from('courses')
      .update({
        name: editName.trim(),
        department: editDepartment.trim() || null,
        description: editDescription.trim() || null,
        semester: editSemester.trim() || null,
      })
      .eq('id', courseId);
    setSavingEdit(false);
    if (error) {
      showToast('Failed to save changes', 'error');
    } else {
      showToast('Course updated');
      setShowEditModal(false);
      loadData();
    }
  };

  const toggleCourseActive = async () => {
    if (!course || togglingActive) return;
    const nextActive = !course.is_active;
    Alert.alert(
      nextActive ? 'Activate Course' : 'Deactivate Course',
      nextActive
        ? 'Students will be able to see and access this course.'
        : 'Students will no longer see this course in their schedule or dashboard.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: nextActive ? 'Activate' : 'Deactivate',
          style: nextActive ? 'default' : 'destructive',
          onPress: async () => {
            setTogglingActive(true);
            const { error } = await supabase
              .from('courses')
              .update({ is_active: nextActive })
              .eq('id', courseId);
            setTogglingActive(false);
            if (error) {
              showToast('Failed to update course status', 'error');
            } else {
              showToast(nextActive ? 'Course activated' : 'Course deactivated');
              loadData();
            }
          },
        },
      ]
    );
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
    <View style={styles.outerContainer}>
    <ScrollView style={styles.container} contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
      {course && (
        <Card style={styles.headerCard}>
          <View style={styles.headerTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.courseNameText}>{course.name}</Text>
              {course.department && <Text style={styles.dept}>{course.department}</Text>}
            </View>
            <TouchableOpacity onPress={toggleCourseActive} disabled={togglingActive} style={styles.activeBadgeTap}>
              <Badge
                text={togglingActive ? '...' : (course.is_active ? 'Active' : 'Inactive')}
                variant={course.is_active ? 'success' : 'neutral'}
                icon={course.is_active ? 'toggle' : 'toggle-outline'}
              />
            </TouchableOpacity>
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
          <View style={styles.cardFooterRow}>
            <View style={styles.toggleHint}>
              <Ionicons name="information-circle-outline" size={13} color={colors.neutral[400]} />
              <Text style={styles.toggleHintText}>Tap the badge to toggle active status</Text>
            </View>
            <TouchableOpacity style={styles.editCourseBtn} onPress={openEditModal}>
              <Ionicons name="create-outline" size={15} color={colors.primary[500]} />
              <Text style={styles.editCourseBtnText}>Edit</Text>
            </TouchableOpacity>
          </View>
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

    {/* Edit Course Modal */}
    <Modal visible={showEditModal} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { paddingBottom: spacing.lg + insets.bottom }]}>
          <Text style={styles.modalTitle}>Edit Course</Text>
          <Input
            label="Course Name"
            placeholder="e.g. Introduction to Computer Science"
            value={editName}
            onChangeText={setEditName}
          />
          <Input
            label="Department"
            placeholder="e.g. Computer Science"
            value={editDepartment}
            onChangeText={setEditDepartment}
          />
          <Input
            label="Semester"
            placeholder="e.g. Fall 2025"
            value={editSemester}
            onChangeText={setEditSemester}
          />
          <Text style={styles.fieldLabel}>Description (optional)</Text>
          <TextInput
            style={styles.textArea}
            placeholder="Course description..."
            value={editDescription}
            onChangeText={setEditDescription}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
            placeholderTextColor={colors.neutral[400]}
          />
          <View style={styles.modalActions}>
            <Button
              title="Cancel"
              variant="outline"
              size="sm"
              onPress={() => setShowEditModal(false)}
              style={{ flex: 1, marginRight: spacing.sm }}
            />
            <Button
              title="Save"
              size="sm"
              onPress={saveCourseEdit}
              loading={savingEdit}
              disabled={!editName.trim() || savingEdit}
              style={{ flex: 1 }}
            />
          </View>
        </View>
      </View>
    </Modal>
    </View>
  );
}

const makeStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  outerContainer: { flex: 1 },
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
  activeBadgeTap: { marginLeft: spacing.sm },
  cardFooterRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.sm },
  toggleHint: { flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1 },
  toggleHintText: { ...typography.tiny, color: colors.neutral[400] },
  editCourseBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.sm, paddingVertical: 6, borderRadius: borderRadius.sm, backgroundColor: colors.primary[50] },
  editCourseBtnText: { ...typography.captionMedium, color: colors.primary[600] },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: colors.neutral[0], borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.lg, maxHeight: '85%' },
  modalTitle: { ...typography.h3, color: colors.neutral[900], marginBottom: spacing.md },
  fieldLabel: { ...typography.captionMedium, color: colors.neutral[700], marginBottom: 6 },
  textArea: { borderWidth: 1.5, borderColor: colors.neutral[200], borderRadius: borderRadius.md, padding: spacing.md, minHeight: 80, ...typography.body, color: colors.neutral[900], marginBottom: spacing.md },
  modalActions: { flexDirection: 'row', marginTop: spacing.sm },
});
