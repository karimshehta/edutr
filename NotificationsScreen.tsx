import React, { useEffect, useState, useCallback, useMemo} from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
  TouchableOpacity, Modal, TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { supabase } from '../../lib/supabase';
import { Card, Button, Badge, EmptyState, AttendanceSkeleton } from '../../components';
import { colors, spacing, typography, borderRadius } from '../../theme';
import { AttendanceSession, Lecture, AttendanceRecord } from '../../types';
import { formatTime, formatDate, getDayName } from '../../lib/helpers';
import XLSX from 'xlsx';
import { useTheme } from '../../contexts/ThemeContext';

type PastSession = AttendanceSession & {
  lectureName?: string;
  lectureDay?: number;
  allSessionIds?: string[];
};

export function ProfAttendance({ route }: any) {

  const { colors, isDark } = useTheme();
  const s = useMemo(() => makeStyles(colors, isDark), [colors, isDark]);
  const insets = useSafeAreaInsets();
  const { courseId, courseName } = route.params;
  const { profile } = useAuth();
  const { showToast } = useToast();
  const [activeSession, setActiveSession] = useState<AttendanceSession | null>(null);
  const [pastSessions, setPastSessions] = useState<PastSession[]>([]);
  const [lectures, setLectures] = useState<Lecture[]>([]);
  const [liveRecords, setLiveRecords] = useState<(AttendanceRecord & { studentName: string; studentEmail: string })[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState(false);
  const [closing, setClosing] = useState(false);
  const [showLectureSelect, setShowLectureSelect] = useState(false);
  const [radius, setRadius] = useState('50');
  const [selectedLecture, setSelectedLecture] = useState<Lecture | null>(null);
  const [openingStep, setOpeningStep] = useState<'lecture' | 'radius' | null>(null);
  const [course, setCourse] = useState<{ is_attendance_published: boolean; total_lectures_held: number } | null>(null);
  const [editingLectures, setEditingLectures] = useState(false);
  const [lecturesValue, setLecturesValue] = useState('0');

  // Calculate lecture date matching web logic
  const calculateLectureDate = (dayOfWeek: number): string => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayDay = today.getDay();
    let diff = dayOfWeek - todayDay;
    if (diff < 0) diff += 7;
    const lectureDate = new Date(today);
    lectureDate.setDate(lectureDate.getDate() + diff);
    const y = lectureDate.getFullYear();
    const m = String(lectureDate.getMonth() + 1).padStart(2, '0');
    const d = String(lectureDate.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const loadData = useCallback(async () => {
    const { data: courseData } = await supabase
      .from('courses')
      .select('is_attendance_published, total_lectures_held')
      .eq('id', courseId).maybeSingle();
    setCourse(courseData);
    if (courseData) setLecturesValue(courseData.total_lectures_held.toString());

    // Active session - match web query exactly
    const { data: active } = await supabase
      .from('attendance_sessions').select('*')
      .eq('course_id', courseId).eq('is_active', true)
      .is('closed_at', null).maybeSingle();
    setActiveSession(active);
    if (active) await loadLiveRecords(active.id);

    // Lectures
    const { data: lectureData } = await supabase
      .from('lectures').select('*')
      .eq('course_id', courseId).eq('is_cancelled', false)
      .order('day_of_week').order('start_time');
    setLectures(lectureData || []);

    // Past sessions - match web grouping logic exactly
    const { data: sessions } = await supabase
      .from('attendance_sessions')
      .select('id, course_id, lecture_id, professor_id, opened_at, closed_at, is_active, lecture_date')
      .eq('course_id', courseId).eq('is_active', false)
      .order('lecture_date', { ascending: false });

    const sessionsWithDetails = (sessions || []).map((s) => {
      const lec = (lectureData || []).find((l) => l.id === s.lecture_id);
      return { ...s, lectureName: lec?.title || 'Unknown', lectureDay: lec?.day_of_week };
    });

    // Group by lecture_id + lecture_date (same as web)
    const grouped: Record<string, PastSession> = {};
    sessionsWithDetails.forEach((s) => {
      const key = `${s.lecture_id}-${s.lecture_date}`;
      if (!grouped[key]) {
        grouped[key] = { ...s, allSessionIds: [s.id] } as PastSession;
      } else {
        grouped[key].allSessionIds?.push(s.id);
        if (s.closed_at && (!grouped[key].closed_at || new Date(s.closed_at) > new Date(grouped[key].closed_at!))) {
          grouped[key].closed_at = s.closed_at;
        }
      }
    });

    const unique = Object.values(grouped).sort((a, b) => {
      const dA = new Date(a.lecture_date || a.closed_at || 0).getTime();
      const dB = new Date(b.lecture_date || b.closed_at || 0).getTime();
      return dB - dA;
    });
    setPastSessions(unique);
    setLoading(false);
  }, [courseId]);

  const loadLiveRecords = async (sessionId: string) => {
    const { data: records } = await supabase
      .from('attendance_records').select('*')
      .eq('session_id', sessionId).order('marked_at', { ascending: false });

    if (records && records.length > 0) {
      const ids = records.map((r) => r.student_id);
      // Fetch student name AND email (matching web platform)
      const { data: profiles } = await supabase
        .from('user_profiles').select('id, first_name, last_name, email').in('id', ids);
      setLiveRecords(records.map((r) => {
        const p = profiles?.find((p) => p.id === r.student_id);
        return { 
          ...r, 
          studentName: p ? `${p.first_name || ''} ${p.last_name || ''}`.trim() : 'Unknown',
          studentEmail: p?.email || '-',
        };
      }));
    } else {
      setLiveRecords([]);
    }
  };

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  useEffect(() => {
    if (!activeSession) return;
    const channel = supabase
      .channel(`att-records-${activeSession.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance_records', filter: `session_id=eq.${activeSession.id}` }, () => {
        loadLiveRecords(activeSession.id);
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [activeSession]);

  const onRefresh = async () => { setRefreshing(true); await loadData(); setRefreshing(false); };

  const openSession = async (lecture: Lecture) => {
    if (!profile) return;
    if (opening) return; // Prevent multiple clicks
    
    setOpening(true);

    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      showToast('Location permission is required', 'error');
      setOpening(false); 
      return;
    }

    // Wait patiently until the device returns a real GPS fix.
    // No timeout, no cached lookup — getCurrentPositionAsync blocks until
    // the OS delivers actual coordinates, even if the user takes several
    // minutes to enable location services.
    let loc: Location.LocationObject;
    try {
      loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
    } catch {
      showToast('Could not get your location. Please enable GPS and try again.', 'error');
      setOpening(false);
      return;
    }

    const lectureDate = calculateLectureDate(lecture.day_of_week);

    // Check for existing closed session
    const { data: existingSessions } = await supabase
      .from('attendance_sessions').select('id')
      .eq('lecture_id', lecture.id).eq('lecture_date', lectureDate)
      .eq('is_active', false).not('closed_at', 'is', null);

    if ((existingSessions || []).length > 0) {
      await supabase.from('attendance_records').delete()
        .eq('session_id', existingSessions![0].id).eq('status', 'absent');
    }

    const { error } = await supabase.from('attendance_sessions').insert({
      course_id: courseId, lecture_id: lecture.id, professor_id: profile.id,
      opened_at: new Date().toISOString(),
      professor_latitude: loc.coords.latitude,
      professor_longitude: loc.coords.longitude,
      is_active: true, lecture_date: lectureDate,
      radius_meters: parseInt(radius) || 50,
    });

    setOpening(false);
    setShowLectureSelect(false);
    setOpeningStep(null);
    setSelectedLecture(null);
    
    if (error) {
      showToast('Failed to open attendance session', 'error');
    } else {
      showToast('Attendance session opened');
      await loadData();
    }
  };

  // Close session + mark absent students
  const closeSession = async () => {
    if (!activeSession) return;
    if (closing) return; // Prevent multiple clicks
    
    setClosing(true);
    
    try {
      // Update session
      await supabase.from('attendance_sessions')
        .update({ is_active: false, closed_at: new Date().toISOString() })
        .eq('id', activeSession.id);

      // Mark absent students
      const { data: enrollments } = await supabase
        .from('enrollments').select('student_id').eq('course_id', courseId);
      const enrolledIds = (enrollments || []).map(e => e.student_id);

      if (enrolledIds.length > 0) {
        const { data: markedStudents } = await supabase
          .from('attendance_records').select('student_id')
          .eq('session_id', activeSession.id);
        const markedSet = new Set((markedStudents || []).map(r => r.student_id));
        const absentIds = enrolledIds.filter(id => !markedSet.has(id));

        if (absentIds.length > 0) {
          const absentRecords = absentIds.map(sid => ({
            session_id: activeSession.id, student_id: sid,
            marked_at: new Date().toISOString(),
            distance_meters: 999, student_latitude: 0, student_longitude: 0,
            status: 'absent' as const, marked_manually: false,
          }));
          await supabase.from('attendance_records').insert(absentRecords);
        }
      }
      
      showToast('Attendance session closed');
      await loadData();
    } catch (error: any) {
      showToast('Failed to close session', 'error');
    } finally {
      setClosing(false);
    }
  };

  const togglePublish = async () => {
    if (!course) return;
    await supabase.from('courses').update({ is_attendance_published: !course.is_attendance_published }).eq('id', courseId);
    loadData();
  };

  const updateTotalLectures = async (v: string) => {
    const val = parseInt(v) || 0;
    if (val < 0) return;
    await supabase.from('courses').update({ total_lectures_held: val }).eq('id', courseId);
    setCourse(course ? { ...course, total_lectures_held: val } : null);
  };

  // === Excel Export ===
  const generateXlsxAndShare = async (wsData: any[], sheetName: string, fileName: string) => {
    const ws = XLSX.utils.json_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'base64' });
    const path = `${FileSystem.documentDirectory}${fileName}`;
    await FileSystem.writeAsStringAsync(path, wbout, { encoding: FileSystem.EncodingType.Base64 });
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(path, { mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    } else {
      showToast('File saved to ' + path, 'info');
    }
  };

  // Export session attendance
  const exportSessionAttendance = async (sessionIds: string[], lectureTitle: string) => {
    try {
      // Fetch all records from all session IDs
      const allRecords: any[] = [];
      for (const sid of sessionIds) {
        const { data } = await supabase.from('attendance_records').select('*').eq('session_id', sid);
        if (data) allRecords.push(...data);
      }

      // Get enrolled students
      const { data: enrollments } = await supabase
        .from('enrollments').select('student_id').eq('course_id', courseId);
      const enrolledIds = (enrollments || []).map(e => e.student_id);

      const { data: profiles } = await supabase
        .from('user_profiles').select('id, first_name, last_name, email').in('id', enrolledIds);

      // Deduplicate: keep best status per student
      const priority: Record<string, number> = { present: 3, late: 2, absent: 1 };
      const recordMap = new Map<string, any>();
      allRecords.forEach(r => {
        const existing = recordMap.get(r.student_id);
        if (!existing || (priority[r.status] || 0) > (priority[existing.status] || 0)) {
          recordMap.set(r.student_id, r);
        }
      });

      const exportData = (profiles || []).map(p => {
        const rec = recordMap.get(p.id);
        const status = rec ? rec.status : 'absent';
        return {
          'Student Name': `${p.first_name || ''} ${p.last_name || ''}`.trim(),
          'Email': p.email,
          'Status': status.charAt(0).toUpperCase() + status.slice(1),
        };
      });

      const fn = `attendance_${lectureTitle.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;
      await generateXlsxAndShare(exportData, 'Attendance', fn);
      showToast('Attendance exported successfully');
    } catch (e) {
      showToast('Failed to export session attendance', 'error');
    }
  };

  // Export term summary
  const exportTermSummary = async () => {
    try {
      // Get all sessions for this course
      const { data: allSessions } = await supabase
        .from('attendance_sessions').select('id')
        .eq('course_id', courseId).eq('is_active', false);
      const sessionIds = (allSessions || []).map(s => s.id);

      if (sessionIds.length === 0) {
        showToast('No past attendance sessions found', 'info');
        return;
      }

      // Get all records
      const { data: allRecords } = await supabase
        .from('attendance_records').select('*').in('session_id', sessionIds);

      // Get enrolled students
      const { data: enrolled } = await supabase
        .from('enrollments').select('student_id').eq('course_id', courseId).eq('is_blocked', false);
      const enrolledIds = (enrolled || []).map(e => e.student_id);

      const { data: profiles } = await supabase
        .from('user_profiles').select('id, first_name, last_name, email').in('id', enrolledIds);

      const totalLectures = course?.total_lectures_held || sessionIds.length;

      const exportData = (profiles || []).map(p => {
        const studentRecs = (allRecords || []).filter(r => r.student_id === p.id);
        const present = studentRecs.filter(r => r.status === 'present').length;
        const late = studentRecs.filter(r => r.status === 'late').length;
        const absent = studentRecs.filter(r => r.status === 'absent').length;
        const attended = present + late;
        return {
          'Student Name': `${p.first_name || ''} ${p.last_name || ''}`.trim(),
          'Email': p.email,
          'Total Lectures': totalLectures,
          'Present': present + late,
          'Absent': totalLectures - attended,
          'Attendance %': totalLectures > 0 ? Number(((attended / totalLectures) * 100).toFixed(1)) : 0,
        };
      });

      const fn = `term_summary_${(courseName || 'Course').replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;
      await generateXlsxAndShare(exportData, 'Term Summary', fn);
      showToast('Term summary exported successfully');
    } catch (e) {
      showToast('Failed to export term summary', 'error');
    }
  };

  return (
    <View style={s.container}>
      <ScrollView contentContainerStyle={s.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        {loading ? (
          <AttendanceSkeleton />
        ) : (
        <>
        {/* Active Session */}
        {activeSession ? (
          <Card style={s.activeCard}>
            <View style={s.activeHeader}>
              <View style={s.liveDot} />
              <Text style={s.activeTitle}>Session Active</Text>
            </View>
            <Text style={s.activeSub}>Radius: {activeSession.radius_meters}m · {liveRecords.filter(r => r.status !== 'absent').length} checked in</Text>

            {liveRecords.filter(r => r.status !== 'absent').map((r) => (
              <View key={r.id} style={s.recordRow}>
                <View style={s.recordLeft}>
                  <Ionicons 
                    name="checkmark-circle" 
                    size={18} 
                    color={r.status === 'present' ? colors.success[500] : colors.warning[500]} 
                  />
                  <View style={s.recordInfo}>
                    <Text style={s.recordName}>{r.studentName}</Text>
                    <Text style={s.recordEmail}>{r.studentEmail}</Text>
                  </View>
                </View>
                <View style={s.recordRight}>
                  <Badge 
                    text={r.status.charAt(0).toUpperCase() + r.status.slice(1)} 
                    variant={r.status === 'present' ? 'success' : 'warning'} 
                  />
                  <Text style={s.recordDist}>{Math.round(r.distance_meters)}m</Text>
                </View>
              </View>
            ))}

            <Button 
              title={closing ? "Closing..." : "Close Session"} 
              variant="danger" 
              size="sm" 
              onPress={closeSession} 
              style={{ marginTop: spacing.sm }}
              loading={closing}
              disabled={closing}
            />
          </Card>
        ) : (
          <Button
            title="Open Attendance Session"
            variant="primary"
            size="md"
            onPress={() => {
              setOpeningStep('lecture');
              setShowLectureSelect(true);
            }}
            icon="hand-left-outline"
          />
        )}

        {/* Course Settings */}
        {course && (
          <>
            <Card style={s.settingsCard}>
              <View style={s.settingRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.settingLabel}>Total Lectures Held</Text>
                  {editingLectures ? (
                    <View style={s.editRow}>
                      <TextInput style={s.lectInput} value={lecturesValue} onChangeText={setLecturesValue} keyboardType="number-pad" placeholderTextColor={colors.neutral[400]} />
                      <Button title="Save" size="sm" onPress={() => { updateTotalLectures(lecturesValue); setEditingLectures(false); }} />
                      <Button title="×" variant="ghost" size="sm" onPress={() => { setLecturesValue(course.total_lectures_held.toString()); setEditingLectures(false); }} />
                    </View>
                  ) : (
                    <TouchableOpacity style={s.lectDisplay} onPress={() => setEditingLectures(true)}>
                      <Text style={s.lectCount}>{course.total_lectures_held}</Text>
                      <Ionicons name="pencil" size={14} color={colors.primary[500]} />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </Card>

            <Card style={s.settingsCard}>
              <View style={s.settingRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.settingLabel}>Attendance Summary</Text>
                  <Text style={s.settingSub}>{course.is_attendance_published ? 'Visible to students' : 'Hidden from students'}</Text>
                </View>
                <Button title={course.is_attendance_published ? 'Unpublish' : 'Publish'} variant={course.is_attendance_published ? 'outline' : 'primary'} size="sm" onPress={togglePublish} />
              </View>
              <Button title="Export Term Summary" variant="secondary" size="sm" onPress={exportTermSummary} style={{ marginTop: spacing.sm }} />
            </Card>
          </>
        )}

        {/* Past Sessions with Download Button */}
        {pastSessions.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Past Sessions</Text>
            {pastSessions.map((sess) => (
              <Card key={sess.id} style={s.pastCard}>
                <View style={s.pastRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.pastLecture}>{sess.lectureName || 'Lecture'}</Text>
                    <Text style={s.pastDate}>
                      {sess.lecture_date ? formatDate(sess.lecture_date) : formatDate(sess.opened_at)}
                    </Text>
                    {sess.closed_at && (
                      <Text style={s.pastTime}>
                        Closed: {new Date(sess.closed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        {(sess.allSessionIds?.length || 0) > 1 && ` · Reopened ${(sess.allSessionIds?.length || 1) - 1}x`}
                      </Text>
                    )}
                  </View>
                  {/* Download Excel Button - matches web */}
                  <TouchableOpacity
                    style={s.downloadBtn}
                    onPress={() => exportSessionAttendance(sess.allSessionIds || [sess.id], sess.lectureName || 'Attendance')}
                  >
                    <Ionicons name="download-outline" size={18} color={colors.neutral[600]} />
                  </TouchableOpacity>
                </View>
              </Card>
            ))}
          </View>
        )}
        </>
        )}
      </ScrollView>

      {/* Step-based Lecture Select Modal (matching web workflow) */}
      <Modal visible={showLectureSelect} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <View style={[s.modalContent, { paddingBottom: spacing.lg + insets.bottom }]}>
            {openingStep === 'lecture' && (
              <>
                <Text style={s.modalTitle}>Step 1: Select Lecture</Text>
                <Text style={s.modalSub}>Choose which lecture to open attendance for:</Text>

                <ScrollView style={s.lectureList}>
                  {lectures.length === 0 ? (
                    <Text style={s.noLectures}>No lectures found. Add lectures first.</Text>
                  ) : (
                    lectures.map((l) => (
                      <TouchableOpacity 
                        key={l.id} 
                        style={s.lectureOption} 
                        onPress={() => {
                          setSelectedLecture(l);
                          setOpeningStep('radius');
                        }}
                      >
                        <View>
                          <Text style={s.lectOptTitle}>{l.title}</Text>
                          <Text style={s.lectOptSub}>
                            {getDayName(l.day_of_week)} · {formatTime(l.start_time)} - {formatTime(l.end_time)}
                          </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={16} color={colors.neutral[300]} />
                      </TouchableOpacity>
                    ))
                  )}
                </ScrollView>

                <Button 
                  title="Cancel" 
                  variant="outline" 
                  size="sm" 
                  onPress={() => {
                    setShowLectureSelect(false);
                    setOpeningStep(null);
                    setSelectedLecture(null);
                  }} 
                  style={{ marginTop: spacing.md }} 
                />
              </>
            )}

            {openingStep === 'radius' && selectedLecture && (
              <>
                <Text style={s.modalTitle}>Step 2: Set Radius</Text>
                <Text style={s.modalSub}>
                  Opening session for: {selectedLecture.title}
                </Text>

                <View style={s.radiusContainer}>
                  <Text style={s.radiusLabel}>Attendance Radius (meters):</Text>
                  <TextInput 
                    style={s.radiusInput} 
                    value={radius} 
                    onChangeText={setRadius} 
                    keyboardType="number-pad" 
                    placeholderTextColor={colors.neutral[400]}
                    placeholder="50"
                  />
                  <Text style={s.radiusHint}>
                    Students must be within this distance to mark attendance
                  </Text>
                </View>

                <View style={s.stepButtons}>
                  <Button 
                    title="Back" 
                    variant="outline" 
                    size="sm" 
                    onPress={() => {
                      setOpeningStep('lecture');
                      setSelectedLecture(null);
                    }} 
                    style={{ flex: 1, marginRight: spacing.sm }} 
                  />
                  <Button 
                    title={opening ? "Opening..." : "Open Session"} 
                    variant="primary" 
                    size="sm" 
                    onPress={() => openSession(selectedLecture)}
                    loading={opening}
                    disabled={opening || !radius || parseInt(radius) <= 0}
                    style={{ flex: 1 }} 
                  />
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const makeStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.neutral[50] },
  content: { padding: spacing.md, paddingBottom: spacing.xxl },

  activeCard: { backgroundColor: colors.success[50], borderWidth: 1, borderColor: colors.success[200], marginBottom: spacing.md, padding: spacing.md },
  activeHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success[500], marginRight: spacing.sm },
  activeTitle: { ...typography.bodyMedium, color: colors.success[700], fontWeight: '600' },
  activeSub: { ...typography.caption, color: colors.success[600], marginBottom: spacing.sm },
  
  // Student record display (matching web with name, email, status)
  recordRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between',
    paddingVertical: 8, 
    paddingHorizontal: 8,
    marginTop: 4,
    backgroundColor: colors.neutral[0],
    borderRadius: borderRadius.sm,
  },
  recordLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  recordInfo: { flex: 1 },
  recordName: { ...typography.captionMedium, color: colors.neutral[800], fontWeight: '600' },
  recordEmail: { ...typography.small, color: colors.neutral[500], marginTop: 1 },
  recordRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  recordDist: { ...typography.small, color: colors.neutral[400], minWidth: 40, textAlign: 'right' },

  settingsCard: { marginBottom: spacing.sm, padding: spacing.md },
  settingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  settingLabel: { ...typography.captionMedium, color: colors.neutral[700], fontWeight: '600' },
  settingSub: { ...typography.small, color: colors.neutral[400], marginTop: 2 },
  editRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center', marginTop: spacing.xs },
  lectInput: { flex: 1, borderWidth: 1, borderColor: colors.neutral[200], borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6, ...typography.body, color: colors.neutral[900] },
  lectDisplay: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 4 },
  lectCount: { ...typography.h3, color: colors.primary[600] },

  section: { marginTop: spacing.sm },
  sectionTitle: { ...typography.bodyMedium, color: colors.neutral[700], fontWeight: '600', marginBottom: spacing.sm },

  pastCard: { marginBottom: spacing.xs, padding: 12 },
  pastRow: { flexDirection: 'row', alignItems: 'center' },
  pastLecture: { ...typography.captionMedium, color: colors.primary[600], fontWeight: '600', marginBottom: 2 },
  pastDate: { ...typography.caption, color: colors.neutral[600] },
  pastTime: { ...typography.small, color: colors.neutral[400], marginTop: 2 },
  downloadBtn: {
    width: 36, height: 36, borderRadius: 8, backgroundColor: colors.neutral[50],
    alignItems: 'center', justifyContent: 'center', marginLeft: spacing.sm,
  },

  // Step-based modal styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: colors.neutral[0], borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: spacing.lg, maxHeight: '80%' },
  modalTitle: { ...typography.h3, color: colors.neutral[900], marginBottom: 4 },
  modalSub: { ...typography.caption, color: colors.neutral[400], marginBottom: spacing.md },
  
  radiusContainer: { 
    backgroundColor: colors.neutral[50], 
    padding: spacing.md, 
    borderRadius: borderRadius.md, 
    marginBottom: spacing.md 
  },
  radiusLabel: { ...typography.captionMedium, color: colors.neutral[700], marginBottom: spacing.sm, fontWeight: '600' },
  radiusInput: { 
    borderWidth: 1, 
    borderColor: colors.neutral[200], 
    borderRadius: borderRadius.sm, 
    paddingHorizontal: 12, 
    paddingVertical: 10, 
    ...typography.body, 
    color: colors.neutral[900],
    backgroundColor: colors.neutral[0],
    marginBottom: spacing.xs,
  },
  radiusHint: { ...typography.small, color: colors.neutral[400], fontStyle: 'italic' },
  stepButtons: { flexDirection: 'row', gap: spacing.sm },
  
  lectureList: { maxHeight: 280 },
  lectureOption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.neutral[100] },
  lectOptTitle: { ...typography.bodyMedium, color: colors.neutral[800] },
  lectOptSub: { ...typography.caption, color: colors.neutral[400], marginTop: 2 },
  noLectures: { ...typography.body, color: colors.neutral[400], textAlign: 'center', paddingVertical: spacing.lg },
});
