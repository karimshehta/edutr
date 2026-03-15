import React, { useState, useCallback, useMemo} from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Linking, Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { supabase } from '../../lib/supabase';
import { Card, Badge, EmptyState, Button } from '../../components';
import { colors, spacing, typography, borderRadius } from '../../theme';
import { Lecture, CourseMaterial, Course } from '../../types';
import { formatTime, getDayName, formatFileSize, formatDate } from '../../lib/helpers';
import { useTheme } from '../../contexts/ThemeContext';

type Tab = 'schedule' | 'materials' | 'attendance';

export function StudentCourseDetail({ route, navigation }: any) {

  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors, isDark), [colors, isDark]);
  const { courseId } = route.params;
  const { profile } = useAuth();
  const { showToast } = useToast();
  const [tab, setTab] = useState<Tab>('schedule');
  const [course, setCourse] = useState<Course | null>(null);
  const [lectures, setLectures] = useState<Lecture[]>([]);
  const [materials, setMaterials] = useState<CourseMaterial[]>([]);
  const [attendanceInfo, setAttendanceInfo] = useState<{ present: number; total: number; published: boolean }>({ present: 0, total: 0, published: false });
  const [refreshing, setRefreshing] = useState(false);
  const [leavingCourse, setLeavingCourse] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);

  const loadData = useCallback(async () => {
    // Check if student is blocked from this course (match web logic)
    const { data: enrollment } = await supabase
      .from('enrollments')
      .select('is_blocked')
      .eq('course_id', courseId)
      .eq('student_id', profile!.id)
      .maybeSingle();

    if (enrollment?.is_blocked) {
      setIsBlocked(true);
      // Still load course name for display
      const { data: courseData } = await supabase.from('courses').select('*').eq('id', courseId).maybeSingle();
      setCourse(courseData);
      return;
    }

    setIsBlocked(false);
    const { data: courseData } = await supabase.from('courses').select('*').eq('id', courseId).maybeSingle();
    setCourse(courseData);
    const { data: lectureData } = await supabase.from('lectures').select('*').eq('course_id', courseId).order('day_of_week').order('start_time');
    setLectures(lectureData || []);
    const { data: matData } = await supabase.from('course_materials').select('*').eq('course_id', courseId).order('is_pinned', { ascending: false }).order('created_at', { ascending: false });
    setMaterials(matData || []);

    if (courseData && profile) {
      if (!courseData.is_attendance_published) {
        setAttendanceInfo({ present: 0, total: 0, published: false });
      } else {
        const { data: sessions } = await supabase.from('attendance_sessions').select('id').eq('course_id', courseId);
        const sessionIds = sessions?.map((s) => s.id) || [];
        if (sessionIds.length > 0) {
          const { data: records } = await supabase.from('attendance_records').select('status').in('session_id', sessionIds).eq('student_id', profile.id);
          const presentCount = (records || []).filter((r) => r.status === 'present' || r.status === 'late').length;
          setAttendanceInfo({ present: presentCount, total: courseData.total_lectures_held || 0, published: true });
        } else {
          setAttendanceInfo({ present: 0, total: courseData.total_lectures_held || 0, published: true });
        }
      }
    }
  }, [courseId, profile]);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));
  const onRefresh = async () => { setRefreshing(true); await loadData(); setRefreshing(false); };
  
  // Open material in-app viewer (matches web behavior - opens inside app, not browser)
  const openMaterial = (material: CourseMaterial) => { 
    navigation.navigate('MaterialViewer', {
      fileUrl: material.file_url,
      fileName: material.title,
      fileType: material.file_type,
    });
  };

  // Download material to device (matches web "Download" functionality)
  const downloadMaterial = async (url: string, fileName: string) => {
    try {
      showToast('Downloading file...', 'info', 3000);
      
      // Download file to local cache
      const fileUri = FileSystem.cacheDirectory + fileName;
      const downloadResult = await FileSystem.downloadAsync(url, fileUri);
      
      console.log('Downloaded to:', downloadResult.uri);
      
      // Share/Save the file
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(downloadResult.uri, {
          mimeType: 'application/octet-stream',
          dialogTitle: 'Save File',
        });
      } else {
        showToast('File downloaded successfully', 'success', 3000);
      }
    } catch (error: any) {
      console.error('Download error:', error);
      showToast(error.message || 'Could not download file', 'error', 4000);
    }
  };

  const handleLeaveCourse = () => {
    Alert.alert(
      'Leave Course?',
      `Are you sure you want to leave "${course?.name}"? You will no longer see it in your course list and will need to re-enroll using the course code if you want to join again.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave Course',
          style: 'destructive',
          onPress: async () => {
            setLeavingCourse(true);
            try {
              // Delete enrollment - blocked_students table persists to prevent re-enrollment
              const { error } = await supabase.from('enrollments').delete().eq('course_id', courseId).eq('student_id', profile!.id);
              if (error) throw error;
              navigation.goBack();
            } catch (err: any) {
              Alert.alert('Error', 'Failed to leave course. ' + (err.message || ''));
            } finally {
              setLeavingCourse(false);
            }
          },
        },
      ]
    );
  };

  const grouped = lectures.reduce<Record<number, Lecture[]>>((acc, l) => {
    if (!acc[l.day_of_week]) acc[l.day_of_week] = [];
    acc[l.day_of_week].push(l);
    return acc;
  }, {});

  const pct = attendanceInfo.total > 0 ? Math.round((attendanceInfo.present / attendanceInfo.total) * 100) : 0;
  const attColor = pct >= 75 ? colors.success[500] : pct >= 50 ? colors.warning[500] : colors.error[500];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
      {course && (
        <Card style={styles.courseHeader}>
          <View style={styles.codeRow}>
            <View style={styles.codeBox}><Text style={styles.codeText}>{course.code}</Text></View>
            {course.semester && <Badge text={course.semester} variant="info" />}
          </View>
          <Text style={styles.courseNameText}>{course.name}</Text>
          {course.department && <Text style={styles.courseDept}>{course.department}</Text>}
        </Card>
      )}

      {isBlocked ? (
        <Card style={styles.blockedCard}>
          <View style={styles.blockedIconContainer}>
            <Ionicons name="ban" size={48} color={colors.error[500]} />
          </View>
          <Text style={styles.blockedTitle}>You have been blocked from this course</Text>
          <Text style={styles.blockedText}>
            You no longer have access to course materials, grades, or attendance.
          </Text>
          <Text style={styles.blockedText}>
            Your enrollment will remain blocked until your instructor unblocks you.
          </Text>
          <Text style={styles.blockedText}>
            Please contact your instructor if you believe this is an error.
          </Text>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backButtonText}>Back to Courses</Text>
          </TouchableOpacity>
        </Card>
      ) : (
        <>
          <View style={styles.tabs}>
            {(['schedule', 'materials', 'attendance'] as Tab[]).map((t) => (
              <TouchableOpacity key={t} style={[styles.tab, tab === t && styles.activeTab]} onPress={() => setTab(t)}>
                <Text style={[styles.tabText, tab === t && styles.activeTabText]}>{t.charAt(0).toUpperCase() + t.slice(1)}</Text>
              </TouchableOpacity>
            ))}
          </View>

      {tab === 'schedule' && (
        <View>
          {Object.keys(grouped).length === 0 ? (
            <EmptyState icon="calendar-outline" title="No Schedule" message="No lectures scheduled for this course yet." />
          ) : (
            Object.entries(grouped).sort(([a], [b]) => Number(a) - Number(b)).map(([day, lecs]) => (
              <View key={day} style={styles.dayGroup}>
                <Text style={styles.dayTitle}>{getDayName(Number(day))}</Text>
                {lecs.map((l) => (
                  <Card key={l.id} style={[styles.lectureCard, l.is_cancelled ? styles.cancelled : undefined]}>
                    <View style={styles.lectureRow}>
                      <View style={styles.timeCol}>
                        <Text style={styles.timeText}>{formatTime(l.start_time)}</Text>
                        <Text style={styles.timeSubText}>{formatTime(l.end_time)}</Text>
                      </View>
                      <View style={styles.lectureInfoCol}>
                        <Text style={styles.lectureTitle}>{l.title}</Text>
                        <View style={styles.metaRow}>
                          <Badge text={l.type} variant="neutral" />
                          {l.location && <Text style={styles.locationText}>{l.location}</Text>}
                        </View>
                        {l.is_cancelled && <Badge text="Cancelled" variant="error" style={{ marginTop: 4 }} />}
                      </View>
                    </View>
                  </Card>
                ))}
              </View>
            ))
          )}
        </View>
      )}

      {tab === 'materials' && (
        <View>
          {materials.length === 0 ? (
            <EmptyState icon="document-outline" title="No Materials" message="No course materials have been uploaded yet." />
          ) : (
            materials.map((m) => (
              <Card key={m.id} style={styles.materialCard}>
                <View style={styles.materialRow}>
                  <View style={styles.fileIcon}>
                    <Ionicons 
                      name={m.file_type === 'pdf' ? 'document-text' : m.file_type === 'image' ? 'image' : 'document'} 
                      size={24} 
                      color={colors.primary[500]} 
                    />
                  </View>
                  <View style={styles.materialInfo}>
                    <View style={styles.materialTitleRow}>
                      <Text style={styles.materialTitle} numberOfLines={1}>{m.title}</Text>
                      {m.is_pinned && <Ionicons name="pin" size={20} color={colors.error[600]} />}
                    </View>
                    <Text style={styles.materialMeta}>
                      {m.file_type.toUpperCase()} - {formatFileSize(m.file_size)} - {formatDate(m.created_at)}
                    </Text>
                  </View>
                  <View style={styles.materialActions}>
                    {/* View Button - Opens in-app viewer */}
                    <TouchableOpacity
                      style={[styles.materialActionBtn, { backgroundColor: colors.info[50] }]}
                      onPress={() => openMaterial(m)}
                    >
                      <Ionicons name="eye-outline" size={18} color={colors.info[600]} />
                    </TouchableOpacity>
                    {/* Download Button */}
                    <TouchableOpacity
                      style={[styles.materialActionBtn, { backgroundColor: colors.success[50] }]}
                      onPress={() => downloadMaterial(m.file_url, m.title)}
                    >
                      <Ionicons name="download-outline" size={18} color={colors.success[600]} />
                    </TouchableOpacity>
                  </View>
                </View>
              </Card>
            ))
          )}
        </View>
      )}

      {tab === 'attendance' && (
        <View>
          {!attendanceInfo.published ? (
            <EmptyState icon="eye-off-outline" title="Not Published" message="Attendance data has not been published for this course yet." />
          ) : (
            <Card style={styles.attendanceCard}>
              <View style={styles.pctCircle}><Text style={[styles.pctText, { color: attColor }]}>{pct}%</Text></View>
              <View style={styles.attStats}>
                <View style={styles.attStat}><Ionicons name="checkmark-circle" size={18} color={colors.success[500]} /><Text style={styles.attStatText}>Present: {attendanceInfo.present}</Text></View>
                <View style={styles.attStat}><Ionicons name="close-circle" size={18} color={colors.error[500]} /><Text style={styles.attStatText}>Absent: {attendanceInfo.total - attendanceInfo.present}</Text></View>
                <View style={styles.attStat}><Ionicons name="list" size={18} color={colors.neutral[500]} /><Text style={styles.attStatText}>Total: {attendanceInfo.total}</Text></View>
              </View>
            </Card>
          )}
        </View>
      )}
      </>
      )}
    </ScrollView>
  );
}

const makeStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.neutral[50] },
  content: { padding: spacing.md, paddingBottom: spacing.xxl },
  courseHeader: { marginBottom: spacing.md },
  codeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  codeBox: { backgroundColor: colors.primary[50], paddingHorizontal: 10, paddingVertical: 4, borderRadius: borderRadius.sm },
  codeText: { ...typography.captionMedium, color: colors.primary[700], fontWeight: '700' },
  courseNameText: { ...typography.h2, color: colors.neutral[900], marginBottom: 4 },
  courseDept: { ...typography.caption, color: colors.neutral[400] },
  tabs: { flexDirection: 'row', backgroundColor: colors.neutral[100], borderRadius: borderRadius.md, padding: 4, marginBottom: spacing.md },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: borderRadius.sm },
  activeTab: { backgroundColor: colors.neutral[0], shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 2, elevation: 1 },
  tabText: { ...typography.captionMedium, color: colors.neutral[400] },
  activeTabText: { color: colors.primary[600] },
  dayGroup: { marginBottom: spacing.md },
  dayTitle: { ...typography.bodyMedium, color: colors.neutral[600], marginBottom: spacing.sm },
  lectureCard: { marginBottom: spacing.sm },
  cancelled: { opacity: 0.6, borderLeftWidth: 3, borderLeftColor: colors.error[400] },
  lectureRow: { flexDirection: 'row' },
  timeCol: { width: 70, alignItems: 'center' },
  timeText: { ...typography.captionMedium, color: colors.primary[600] },
  timeSubText: { ...typography.small, color: colors.neutral[400] },
  lectureInfoCol: { flex: 1, marginLeft: spacing.sm },
  lectureTitle: { ...typography.bodyMedium, color: colors.neutral[800], marginBottom: 4 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  locationText: { ...typography.caption, color: colors.neutral[400] },
  materialCard: { marginBottom: spacing.sm },
  materialRow: { flexDirection: 'row', alignItems: 'center' },
  fileIcon: { width: 44, height: 44, borderRadius: borderRadius.md, backgroundColor: colors.primary[50], alignItems: 'center', justifyContent: 'center', marginRight: spacing.sm },
  materialInfo: { flex: 1 },
  materialTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  materialTitle: { ...typography.bodyMedium, color: colors.neutral[800], flex: 1 },
  materialMeta: { ...typography.small, color: colors.neutral[400], marginTop: 2 },
  materialActions: { 
    flexDirection: 'row', 
    gap: spacing.xs 
  },
  materialActionBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attendanceCard: { alignItems: 'center', padding: spacing.lg },
  pctCircle: { width: 100, height: 100, borderRadius: 50, borderWidth: 4, borderColor: colors.neutral[200], alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md },
  pctText: { ...typography.h1, fontWeight: '700' },
  attStats: { width: '100%', gap: spacing.sm },
  attStat: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  attStatText: { ...typography.body, color: colors.neutral[600] },
  blockedCard: { alignItems: 'center', padding: spacing.xl },
  blockedIconContainer: { marginBottom: spacing.md },
  blockedTitle: { ...typography.h3, color: colors.error[600], marginBottom: spacing.sm, textAlign: 'center' },
  blockedText: { ...typography.body, color: colors.neutral[600], marginBottom: spacing.sm, textAlign: 'center', lineHeight: 20 },
  backButton: { marginTop: spacing.md, paddingVertical: 12, paddingHorizontal: 24, backgroundColor: colors.primary[500], borderRadius: borderRadius.md },
  backButtonText: { ...typography.button, color: '#fff' },
});
