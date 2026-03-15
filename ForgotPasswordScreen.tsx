import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { supabase } from '../../lib/supabase';
import { Card, EmptyState, ScheduleSkeleton } from '../../components';
import { colors, spacing, typography, borderRadius } from '../../theme';
import { Lecture, AttendanceSession } from '../../types';
import { useTheme } from '../../contexts/ThemeContext';
import {
  formatTime, getDayShortName, getNextOccurrence,
  isToday as checkIsToday, formatShortDate, formatScheduleDate,
  getOrderedWeekDays, calculateDistance,
} from '../../lib/helpers';

type LectureWithCourse = Lecture & { courseName: string; courseCode: string; nextDate: Date };
type DayInfo = { dayOfWeek: number; date: Date; isToday: boolean };

export function StudentSchedule() {

  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors, isDark), [colors, isDark]);
  const { profile } = useAuth();
  const { showToast } = useToast();
  const [selectedDay, setSelectedDay] = useState(new Date().getDay());
  const [lectures, setLectures] = useState<LectureWithCourse[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [allLectures, setAllLectures] = useState<LectureWithCourse[]>([]);
  const [weekDays, setWeekDays] = useState<DayInfo[]>([]);

  // Attendance state - matching web logic
  const [activeSessions, setActiveSessions] = useState<Record<string, AttendanceSession>>({});
  const [attendanceStatus, setAttendanceStatus] = useState<Record<string, boolean>>({});
  const [attendanceLoading, setAttendanceLoading] = useState<Record<string, boolean>>({});
  const [courseIds, setCourseIds] = useState<string[]>([]);

  // Calculate today's ISO date for matching
  const getTodayISO = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const loadData = useCallback(async () => {
    if (!profile) return;
    setWeekDays(getOrderedWeekDays());

    const { data: enrollments } = await supabase
      .from('enrollments').select('course_id')
      .eq('student_id', profile.id).eq('is_blocked', false);
    const ids = enrollments?.map((e) => e.course_id) || [];
    setCourseIds(ids);
    if (ids.length === 0) { setAllLectures([]); setLectures([]); setLoading(false); return; }

    const { data: courses } = await supabase
      .from('courses').select('id, name, code').in('id', ids).eq('is_active', true);
    const activeIds = courses?.map((c) => c.id) || [];
    if (activeIds.length === 0) { setAllLectures([]); setLectures([]); setLoading(false); return; }

    const { data: lectureData } = await supabase
      .from('lectures').select('*').in('course_id', activeIds)
      .order('start_time', { ascending: true });

    const mapped: LectureWithCourse[] = (lectureData || []).map((l) => {
      const c = courses?.find((c) => c.id === l.course_id);
      return { ...l, courseName: c?.name || '', courseCode: c?.code || '', nextDate: getNextOccurrence(l.day_of_week) };
    });
    setAllLectures(mapped);

    // Load active sessions for all enrolled courses (web logic)
    const { data: sessions } = await supabase
      .from('attendance_sessions').select('*')
      .in('course_id', activeIds).eq('is_active', true).is('closed_at', null);

    const sessMap: Record<string, AttendanceSession> = {};
    (sessions || []).forEach((s) => { sessMap[s.course_id] = s; });
    setActiveSessions(sessMap);

    // Check which lectures student already marked attendance for
    if (sessions && sessions.length > 0 && profile) {
      const sessionIds = sessions.map(s => s.id);
      const { data: records } = await supabase
        .from('attendance_records').select('session_id, student_id, status')
        .eq('student_id', profile.id).in('session_id', sessionIds)
        .in('status', ['present', 'late']);

      const statusMap: Record<string, boolean> = {};
      (records || []).forEach(r => {
        const session = sessions.find(s => s.id === r.session_id);
        if (session) {
          statusMap[`${session.lecture_id}-${session.lecture_date}`] = true;
        }
      });
      setAttendanceStatus(statusMap);
    }
    setLoading(false);
  }, [profile]);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  // Realtime subscription for attendance sessions (matching web)
  useEffect(() => {
    if (courseIds.length === 0) return;
    const channels = courseIds.map(cid => {
      return supabase
        .channel(`att-sched-${cid}`)
        .on('postgres_changes', {
          event: '*', schema: 'public', table: 'attendance_sessions',
          filter: `course_id=eq.${cid}`,
        }, (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const s = payload.new as AttendanceSession;
            if (s.is_active && !s.closed_at) {
              setActiveSessions(prev => ({ ...prev, [s.course_id]: s }));
            } else {
              setActiveSessions(prev => {
                const next = { ...prev };
                delete next[s.course_id];
                return next;
              });
            }
          } else if (payload.eventType === 'DELETE') {
            setActiveSessions(prev => {
              const next = { ...prev };
              delete next[cid];
              return next;
            });
          }
        }).subscribe();
    });
    return () => { channels.forEach(ch => supabase.removeChannel(ch)); };
  }, [courseIds]);

  useEffect(() => {
    setLectures(allLectures.filter((l) => l.day_of_week === selectedDay));
  }, [allLectures, selectedDay]);

  const onRefresh = async () => { setRefreshing(true); await loadData(); setRefreshing(false); };

  // "I am here" handler - matches web markStudentAttendance logic
  const handleMarkAttendance = async (lecture: LectureWithCourse) => {
    if (!profile) return;
    const session = activeSessions[lecture.course_id];
    if (!session) return;

    const lectureKey = `${lecture.id}-${session.lecture_date}`;
    setAttendanceLoading(prev => ({ ...prev, [lectureKey]: true }));

    try {
      // Verify session still active
      const { data: currentSession } = await supabase
        .from('attendance_sessions').select('*')
        .eq('id', session.id).eq('is_active', true).is('closed_at', null).maybeSingle();

      if (!currentSession) {
        showToast('This attendance session has been closed.', 'error', 4000);
        setActiveSessions(prev => { const n = { ...prev }; delete n[lecture.course_id]; return n; });
        return;
      }

      if (!currentSession.professor_latitude || !currentSession.professor_longitude) {
        showToast('Professor location not available.', 'error', 4000);
        return;
      }

      // Duplicate check (web logic: same lecture+date across all sessions)
      if (currentSession.lecture_date) {
        const { data: sameDaySessions } = await supabase
          .from('attendance_sessions').select('id')
          .eq('lecture_id', currentSession.lecture_id).eq('lecture_date', currentSession.lecture_date);
        const sids = (sameDaySessions || []).map(s => s.id);
        if (sids.length > 0) {
          const { data: existing } = await supabase
            .from('attendance_records').select('id')
            .eq('student_id', profile.id).in('session_id', sids)
            .in('status', ['present', 'late']).maybeSingle();
          if (existing) {
            showToast('You have already marked attendance for this lecture today.', 'info', 4000);
            setAttendanceStatus(prev => ({ ...prev, [lectureKey]: true }));
            return;
          }
        }
      }

      // Get location
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        showToast('Location permission is required to mark attendance.', 'error', 4000);
        return;
      }

      let loc: Location.LocationObject;
      try {
        loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      } catch {
        showToast('Could not get your location. Please enable GPS.', 'error', 4000);
        return;
      }

      // Distance check (web logic)
      const dist = calculateDistance(
        currentSession.professor_latitude, currentSession.professor_longitude,
        loc.coords.latitude, loc.coords.longitude
      );
      const allowedRadius = currentSession.radius_meters ?? 50;
      if (dist > allowedRadius) {
        showToast(`You are ${Math.round(dist)}m away. Must be within ${allowedRadius}m.`, 'error', 4000);
        return;
      }

      // Mark attendance
      const { error } = await supabase.from('attendance_records').insert({
        session_id: currentSession.id,
        student_id: profile.id,
        marked_at: new Date().toISOString(),
        distance_meters: Math.round(dist),
        student_latitude: loc.coords.latitude,
        student_longitude: loc.coords.longitude,
        status: 'present',
        marked_manually: false,
      });

      if (error) {
        if (error.code === '23505') {
          setAttendanceStatus(prev => ({ ...prev, [lectureKey]: true }));
          showToast('Attendance already recorded.', 'info', 4000);
        } else {
          showToast('Failed to mark attendance.', 'error', 4000);
        }
      } else {
        setAttendanceStatus(prev => ({ ...prev, [lectureKey]: true }));
        showToast(`Attendance marked! Distance: ${Math.round(dist)}m`, 'success', 4000);
      }
    } finally {
      setAttendanceLoading(prev => ({ ...prev, [lectureKey]: false }));
    }
  };

  const selectedDayInfo = weekDays.find(d => d.dayOfWeek === selectedDay);
  
  // Calculate ISO date for the selected day (not just today!)
  const selectedDayISO = selectedDayInfo ? 
    `${selectedDayInfo.date.getFullYear()}-${String(selectedDayInfo.date.getMonth() + 1).padStart(2, '0')}-${String(selectedDayInfo.date.getDate()).padStart(2, '0')}` 
    : getTodayISO();

  // Show skeleton while loading
  if (loading) {
    return (
      <View style={styles.container}>
        <ScheduleSkeleton />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Day Picker - TODAY FIRST */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dayPicker} contentContainerStyle={styles.dayPickerContent}>
        {weekDays.map((day) => {
          const isSelected = day.dayOfWeek === selectedDay;
          const count = allLectures.filter((l) => l.day_of_week === day.dayOfWeek).length;
          return (
            <TouchableOpacity
              key={day.dayOfWeek}
              style={[styles.dayBtn, isSelected && styles.dayBtnActive, day.isToday && !isSelected && styles.dayBtnToday]}
              onPress={() => setSelectedDay(day.dayOfWeek)}
              activeOpacity={0.7}
            >
              <Text style={[styles.dayName, isSelected && styles.dayNameActive, day.isToday && !isSelected && styles.dayNameToday]}>
                {day.isToday ? 'Today' : getDayShortName(day.dayOfWeek)}
              </Text>
              <Text style={[styles.dayDate, isSelected && styles.dayDateActive, day.isToday && !isSelected && styles.dayDateToday]}>
                {formatShortDate(day.date)}
              </Text>
              {count > 0 && (
                <View style={[styles.countBadge, isSelected && styles.countBadgeActive]}>
                  <Text style={[styles.countText, isSelected && styles.countTextActive]}>{count}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />} showsVerticalScrollIndicator={false}>
        {lectures.length === 0 ? (
          <EmptyState icon="calendar-clear-outline" title="No Classes" message={`No classes scheduled for ${selectedDayInfo?.isToday ? 'today' : 'this day'}.`} />
        ) : (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{lectures.length} {lectures.length === 1 ? 'Class' : 'Classes'}</Text>
              <Text style={styles.sectionDate}>{selectedDayInfo ? formatScheduleDate(selectedDayInfo.date) : ''}</Text>
            </View>
            {lectures.map((lecture) => {
              // Check if there's an active session for THIS lecture (matches web exactly)
              const session = activeSessions[lecture.course_id];
              const isSessionForThisLecture = session
                && session.lecture_id === lecture.id
                && session.lecture_date === selectedDayISO;
              const lectureKey = `${lecture.id}-${selectedDayISO}`;
              const isMarked = attendanceStatus[lectureKey] || false;
              const isLoading = attendanceLoading[lectureKey] || false;

              return (
                <Card key={lecture.id} style={[
                  styles.lectureCard,
                  lecture.is_cancelled && styles.cancelledLectureCard
                ]}>
                  <View style={styles.timeBadge}>
                    <Ionicons 
                      name="time-outline" 
                      size={14} 
                      color={lecture.is_cancelled ? colors.error[500] : colors.primary[500]} 
                    />
                    <Text style={[
                      styles.timeText,
                      lecture.is_cancelled && styles.cancelledText
                    ]}>
                      {formatTime(lecture.start_time)} - {formatTime(lecture.end_time)}
                    </Text>
                  </View>
                  <View style={styles.courseHeader}>
                    <View style={[
                      styles.courseIconBox,
                      lecture.is_cancelled && styles.cancelledIconBox
                    ]}>
                      <Ionicons 
                        name={lecture.is_cancelled ? "close-circle" : "book"} 
                        size={18} 
                        color={lecture.is_cancelled ? colors.error[500] : colors.primary[500]} 
                      />
                    </View>
                    <View style={styles.courseInfo}>
                      <Text style={[
                        styles.courseTitle,
                        lecture.is_cancelled && styles.cancelledTitle
                      ]} numberOfLines={1}>
                        {lecture.title || lecture.courseName}
                      </Text>
                      <Text style={[
                        styles.courseName,
                        lecture.is_cancelled && styles.cancelledSubtext
                      ]} numberOfLines={1}>
                        {lecture.courseName}
                      </Text>
                    </View>
                    <View style={styles.courseCodeBadge}>
                      <Text style={styles.courseCodeText}>{lecture.courseCode}</Text>
                    </View>
                  </View>
                  {lecture.location ? (
                    <View style={styles.detailItem}>
                      <Ionicons 
                        name="location" 
                        size={13} 
                        color={lecture.is_cancelled ? colors.error[400] : colors.neutral[400]} 
                      />
                      <Text style={[
                        styles.detailText,
                        lecture.is_cancelled && styles.cancelledSubtext
                      ]} numberOfLines={1}>
                        {lecture.location}
                      </Text>
                    </View>
                  ) : null}

                  {/* Cancelled badge - matches web */}
                  {lecture.is_cancelled && (
                    <View style={styles.cancelledBadgeContainer}>
                      <View style={styles.cancelledBadge}>
                        <Ionicons name="close-circle" size={14} color={colors.error[600]} />
                        <Text style={styles.cancelledBadgeText}>Cancelled</Text>
                      </View>
                    </View>
                  )}

                  {/* "I am here" button - only show if NOT cancelled */}
                  {isSessionForThisLecture && !lecture.is_cancelled && (
                    <TouchableOpacity
                      style={[
                        styles.attendanceBtn,
                        isMarked && styles.attendanceBtnMarked,
                        isLoading && styles.attendanceBtnLoading,
                      ]}
                      onPress={() => handleMarkAttendance(lecture)}
                      disabled={isLoading || isMarked}
                      activeOpacity={0.8}
                    >
                      {isMarked ? (
                        <>
                          <Ionicons name="checkmark-circle" size={16} color={colors.success[600]} />
                          <Text style={styles.attendanceBtnTextMarked}>Attendance Marked</Text>
                        </>
                      ) : isLoading ? (
                        <Text style={styles.attendanceBtnText}>Marking...</Text>
                      ) : (
                        <Text style={styles.attendanceBtnText}>I am here</Text>
                      )}
                    </TouchableOpacity>
                  )}
                </Card>
              );
            })}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const makeStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.neutral[50] },
  dayPicker: {
    maxHeight: 110, backgroundColor: colors.neutral[0],
    borderBottomWidth: 1, borderBottomColor: colors.neutral[100],
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2,
  },
  dayPickerContent: { paddingHorizontal: spacing.md, paddingVertical: spacing.md, gap: spacing.sm },
  dayBtn: {
    minWidth: 72, paddingHorizontal: spacing.sm, paddingVertical: spacing.md,
    borderRadius: 14, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.neutral[50], position: 'relative',
  },
  dayBtnActive: {
    backgroundColor: colors.primary[500],
    shadowColor: colors.primary[500], shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  dayBtnToday: { borderWidth: 2, borderColor: colors.primary[300], backgroundColor: colors.primary[50] },
  dayName: { ...typography.captionMedium, color: colors.neutral[600], fontSize: 11, fontWeight: '600', textTransform: 'uppercase', marginBottom: 2 },
  dayNameActive: { color: '#fff' },
  dayNameToday: { color: colors.primary[600] },
  dayDate: { ...typography.captionMedium, color: colors.neutral[700], fontSize: 13, fontWeight: '700' },
  dayDateActive: { color: '#fff' },
  dayDateToday: { color: colors.primary[700] },
  countBadge: {
    position: 'absolute', top: 4, right: 4,
    backgroundColor: colors.primary[100], minWidth: 18, height: 18, borderRadius: 9,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4,
  },
  countBadgeActive: { backgroundColor: 'rgba(255,255,255,0.3)' },
  countText: { ...typography.small, color: colors.primary[600], fontSize: 10, fontWeight: '700' },
  countTextActive: { color: '#fff' },
  content: { padding: spacing.md, paddingBottom: spacing.xxl },
  sectionHeader: { marginBottom: spacing.md },
  sectionTitle: { ...typography.h3, color: colors.neutral[800], fontWeight: '700', marginBottom: 4 },
  sectionDate: { ...typography.body, color: colors.neutral[500], fontSize: 14 },
  lectureCard: { marginBottom: spacing.md, padding: spacing.md, overflow: 'hidden' },
  timeBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.primary[50], alignSelf: 'flex-start',
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, marginBottom: spacing.sm,
  },
  timeText: { ...typography.captionMedium, color: colors.primary[700], fontWeight: '600', fontSize: 12 },
  courseHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs, gap: spacing.sm },
  courseIconBox: { width: 36, height: 36, borderRadius: 10, backgroundColor: colors.primary[50], alignItems: 'center', justifyContent: 'center' },
  courseInfo: { flex: 1, marginRight: spacing.sm },
  courseTitle: { ...typography.bodyMedium, color: colors.neutral[900], fontWeight: '600', marginBottom: 1, fontSize: 14 },
  courseName: { ...typography.caption, color: colors.neutral[500], fontSize: 12 },
  courseCodeBadge: { backgroundColor: colors.info[50], paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  courseCodeText: { ...typography.small, color: colors.info[600], fontWeight: '600', fontSize: 10 },
  detailItem: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  detailText: { ...typography.caption, color: colors.neutral[600], fontSize: 12 },

  // "I am here" button styles
  attendanceBtn: {
    marginTop: spacing.sm, paddingVertical: 10, borderRadius: 8,
    backgroundColor: colors.primary[500], alignItems: 'center', justifyContent: 'center',
    flexDirection: 'row', gap: 6,
  },
  attendanceBtnMarked: {
    backgroundColor: colors.success[50], borderWidth: 1, borderColor: colors.success[200],
  },
  attendanceBtnLoading: {
    backgroundColor: colors.primary[200],
  },
  attendanceBtnText: { ...typography.captionMedium, color: '#fff', fontWeight: '600' },
  attendanceBtnTextMarked: { ...typography.captionMedium, color: colors.success[700], fontWeight: '600' },
  
  // Cancelled lecture styles (matches web exactly)
  cancelledLectureCard: {
    backgroundColor: colors.error[50],
    opacity: 0.85,
  },
  cancelledText: {
    color: colors.error[600],
    textDecorationLine: 'line-through', // Strikethrough like web
  },
  cancelledTitle: {
    color: colors.error[600],
    textDecorationLine: 'line-through', // Strikethrough like web
  },
  cancelledSubtext: {
    color: colors.error[500],
  },
  cancelledIconBox: {
    backgroundColor: colors.error[50],
  },
  cancelledBadgeContainer: {
    marginTop: spacing.sm,
  },
  cancelledBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.error[100],
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  cancelledBadgeText: {
    ...typography.small,
    color: colors.error[700],
    fontWeight: '600',
    fontSize: 11,
  },
});
