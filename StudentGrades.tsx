import React, { useState, useCallback, useMemo} from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { supabase } from '../../lib/supabase';
import { Card, EmptyState, Badge, ScheduleSkeleton, Input, Button } from '../../components';
import { colors, spacing, typography, borderRadius } from '../../theme';
import { Lecture } from '../../types';
import { formatTime, getDayShortName, formatShortDate, getOrderedWeekDays, getDayName } from '../../lib/helpers';
import { useTheme } from '../../contexts/ThemeContext';

// Day picker options — same as ManageSchedule
const DAYS = [
  { value: 0, label: 'Sun' }, { value: 1, label: 'Mon' }, { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' }, { value: 4, label: 'Thu' }, { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
];

export function ProfessorSchedule() {

  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors, isDark), [colors, isDark]);
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const { showToast } = useToast();

  // Day picker state
  const [selectedDay, setSelectedDay] = useState(new Date().getDay());
  const [allLectures, setAllLectures] = useState<(Lecture & { courseName: string; courseCode: string })[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [weekDays, setWeekDays] = useState(getOrderedWeekDays());
  const [loading, setLoading] = useState(true);

  const [cancellingLecture, setCancellingLecture] = useState<string | null>(null);
  const [deletingLecture, setDeletingLecture] = useState<string | null>(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancellingItem, setCancellingItem] = useState<(Lecture & { courseName: string; courseCode: string }) | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  const [showModal, setShowModal] = useState(false);
  const [editingLecture, setEditingLecture] = useState<Lecture | null>(null);
  const [title, setTitle] = useState('');
  const [dayOfWeek, setDayOfWeek] = useState(1);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:30');
  const [location, setLocation] = useState('');
  const [lectureType, setLectureType] = useState<'lecture' | 'section'>('lecture');
  const [saving, setSaving] = useState(false);

  // ─── Data loading ────────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    if (!profile) return;
    setWeekDays(getOrderedWeekDays());

    const { data: assignments } = await supabase
      .from('course_assignments').select('course_id').eq('user_id', profile.id);
    const { data: created } = await supabase
      .from('courses').select('id').eq('created_by', profile.id);

    const allIds = [...new Set([
      ...(assignments?.map((a) => a.course_id) || []),
      ...(created?.map((c) => c.id) || []),
    ])];

    if (allIds.length === 0) { setAllLectures([]); setLoading(false); return; }

    const { data: courses } = await supabase
      .from('courses').select('id, name, code').in('id', allIds).eq('is_active', true);
    const activeIds = courses?.map((c) => c.id) || [];
    if (activeIds.length === 0) { setAllLectures([]); setLoading(false); return; }

    const { data: lectureData } = await supabase
      .from('lectures').select('*').in('course_id', activeIds).order('start_time', { ascending: true });

    setAllLectures((lectureData || []).map((l) => {
      const c = courses?.find((c) => c.id === l.course_id);
      return { ...l, courseName: c?.name || '', courseCode: c?.code || '' };
    }));
    setLoading(false);
  }, [profile]);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const onRefresh = async () => { setRefreshing(true); await loadData(); setRefreshing(false); };

  // ─── Handlers — exact logic from ManageSchedule ──────────────────────────────

  // notifyStudents takes courseId as param (lectures here span multiple courses)
  const notifyStudents = async (message: string, courseId: string) => {
    const { data: enrollments } = await supabase
      .from('enrollments').select('student_id').eq('course_id', courseId);
    if (enrollments && enrollments.length > 0) {
      const notifs = enrollments.map((e) => ({
        user_id: e.student_id, title: 'Schedule Update', message, type: 'schedule', link: `/course/${courseId}`,
      }));
      await supabase.from('notifications').insert(notifs);
    }
  };

  // resetForm — exact copy from ManageSchedule
  const resetForm = () => {
    setTitle(''); setDayOfWeek(1); setStartTime('09:00'); setEndTime('10:30');
    setLocation(''); setLectureType('lecture'); setEditingLecture(null);
  };

  // openEditModal — exact copy from ManageSchedule
  const openEditModal = (lecture: Lecture) => {
    setEditingLecture(lecture);
    setTitle(lecture.title);
    setDayOfWeek(lecture.day_of_week);
    setStartTime(lecture.start_time.slice(0, 5));
    setEndTime(lecture.end_time.slice(0, 5));
    setLocation(lecture.location || '');
    setLectureType(lecture.type);
    setShowModal(true);
  };

  // saveLecture — exact logic from ManageSchedule (edit-only; no Add in global view)
  const saveLecture = async () => {
    if (!editingLecture || !title.trim() || !profile) return;
    setSaving(true);

    const newDayName = getDayName(dayOfWeek);
    await supabase.from('lectures').update({
      title: title.trim(),
      day_of_week: dayOfWeek,
      start_time: startTime + ':00',
      end_time: endTime + ':00',
      location: location.trim() || null,
      type: lectureType,
      previous_day_of_week: editingLecture.day_of_week,
      previous_start_time: editingLecture.start_time,
      previous_end_time: editingLecture.end_time,
      notification_sent_at: new Date().toISOString(),
    }).eq('id', editingLecture.id);

    await notifyStudents(
      `Lecture "${title.trim()}" has been updated: ${newDayName} ${startTime}-${endTime}`,
      editingLecture.course_id,
    );

    setSaving(false);
    setShowModal(false);
    resetForm();
    loadData();
  };

  const openCancelModal = (lecture: Lecture & { courseName: string; courseCode: string }) => {
    setCancellingItem(lecture);
    setCancelReason('');
    setShowCancelModal(true);
  };

  const confirmCancelLecture = async () => {
    if (!cancellingItem || cancellingLecture) return;
    setCancellingLecture(cancellingItem.id);
    try {
      const { error } = await supabase
        .from('lectures')
        .update({
          is_cancelled: true,
          cancelled_reason: cancelReason.trim() || null,
          notification_sent_at: new Date().toISOString(),
        })
        .eq('id', cancellingItem.id);

      if (error) throw error;

      const msg = cancelReason.trim()
        ? `Lecture "${cancellingItem.title}" has been cancelled. Reason: ${cancelReason.trim()}`
        : `Lecture "${cancellingItem.title}" has been cancelled.`;
      await notifyStudents(msg, cancellingItem.course_id);
      showToast(`"${cancellingItem.title}" cancelled`, 'info', 3000);
      setShowCancelModal(false);
      setCancellingItem(null);
      setCancelReason('');
      await loadData();
    } catch (err: any) {
      showToast(err.message || 'Failed to cancel lecture', 'error', 4000);
    } finally {
      setCancellingLecture(null);
    }
  };

  const reactivateLecture = async (lecture: Lecture & { courseName: string; courseCode: string }) => {
    if (cancellingLecture) return;
    setCancellingLecture(lecture.id);
    try {
      const { error } = await supabase
        .from('lectures')
        .update({
          is_cancelled: false,
          cancelled_reason: null,
          notification_sent_at: new Date().toISOString(),
        })
        .eq('id', lecture.id);

      if (error) throw error;
      await notifyStudents(`Lecture "${lecture.title}" has been reactivated.`, lecture.course_id);
      showToast(`"${lecture.title}" reactivated`, 'success', 3000);
      await loadData();
    } catch (err: any) {
      showToast(err.message || 'Failed to reactivate lecture', 'error', 4000);
    } finally {
      setCancellingLecture(null);
    }
  };

  // deleteLecture — exact copy from ManageSchedule
  const deleteLecture = async (lecture: Lecture & { courseName: string; courseCode: string }) => {
    if (deletingLecture) return;
    setDeletingLecture(lecture.id);
    try {
      await supabase.from('lectures').delete().eq('id', lecture.id);
      await notifyStudents(
        `Lecture "${lecture.title}" has been removed from the schedule.`,
        lecture.course_id,
      );
      showToast('Lecture deleted');
      await loadData();
    } catch (error: any) {
      showToast('Failed to delete lecture', 'error');
    } finally {
      setDeletingLecture(null);
    }
  };

  const dayLectures = allLectures.filter((l) => l.day_of_week === selectedDay);

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      {/* Day picker strip */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dayPicker} contentContainerStyle={styles.dayPickerContent}>
        {weekDays.map((d) => {
          const isSelected = d.dayOfWeek === selectedDay;
          const count = allLectures.filter((l) => l.day_of_week === d.dayOfWeek).length;
          return (
            <TouchableOpacity
              key={d.dayOfWeek}
              style={[styles.dayBtn, isSelected && styles.dayBtnActive, d.isToday && !isSelected && styles.dayBtnToday]}
              onPress={() => setSelectedDay(d.dayOfWeek)}
            >
              <Text style={[styles.dayText, isSelected && styles.dayTextActive, d.isToday && !isSelected && styles.dayTextToday]}>
                {d.isToday ? 'Today' : getDayShortName(d.dayOfWeek)}
              </Text>
              <Text style={[styles.dayDateText, isSelected && styles.dayDateTextActive, d.isToday && !isSelected && styles.dayDateTextToday]}>
                {formatShortDate(d.date)}
              </Text>
              {count > 0 && (
                <Text style={[styles.dayCount, isSelected && styles.dayCountActive]}>{count}</Text>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Lecture list */}
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        {loading ? (
          <ScheduleSkeleton />
        ) : dayLectures.length === 0 ? (
          <EmptyState icon="calendar-clear-outline" title="No Classes" message="No classes scheduled for this day." />
        ) : (
          dayLectures.map((l) => (
            <Card key={l.id} style={[styles.lectureCard, l.is_cancelled && styles.cancelledCard]}>
              <View style={styles.lectureRow}>
                {/* Time column — vertical, matching Dashboard */}
                <View style={styles.timeCol}>
                  <Text style={[styles.timeText, l.is_cancelled && styles.cancelledTimeText]}>
                    {formatTime(l.start_time)}
                  </Text>
                  <Text style={[styles.timeSub, l.is_cancelled && styles.cancelledTimeText]}>
                    {formatTime(l.end_time)}
                  </Text>
                </View>

                {/* Vertical divider */}
                <View style={[styles.timeDivider, l.is_cancelled && styles.cancelledDivider]} />

                {/* Lecture details */}
                <View style={styles.lectureInfo}>
                  <Text style={[styles.lectureTitle, l.is_cancelled && styles.cancelledTitle]}>
                    {l.title}
                  </Text>
                  <Text style={styles.lecCourseName}>{l.courseName}</Text>
                  <View style={styles.metaRow}>
                    <Badge text={l.courseCode} variant="info" />
                    {l.location && <Text style={styles.location}>{l.location}</Text>}
                  </View>
                  {l.is_cancelled && (
                    <View>
                      <View style={styles.cancelledBadgeRow}>
                        <Ionicons name="close-circle" size={13} color={colors.error[500]} />
                        <Text style={styles.cancelledBadgeText}>Cancelled</Text>
                      </View>
                      {(l as any).cancelled_reason ? (
                        <Text style={styles.cancelledReason} numberOfLines={2}>{(l as any).cancelled_reason}</Text>
                      ) : null}
                    </View>
                  )}
                </View>

                {/* Action row — [Edit] [Cancel] [Delete] — exact same as ManageSchedule */}
                <View style={styles.actionRow}>
                  <TouchableOpacity style={styles.actionBtn} onPress={() => openEditModal(l)}>
                    <Ionicons name="create-outline" size={17} color={colors.primary[500]} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.actionBtnCancel, l.is_cancelled && styles.actionBtnReactivate]}
                    onPress={() => l.is_cancelled ? reactivateLecture(l) : openCancelModal(l)}
                    disabled={cancellingLecture === l.id}
                  >
                    <Ionicons
                      name={cancellingLecture === l.id ? 'hourglass-outline' : (l.is_cancelled ? 'checkmark-circle-outline' : 'close-circle-outline')}
                      size={17}
                      color={l.is_cancelled ? colors.success[600] : colors.error[500]}
                    />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={() => deleteLecture(l)}
                    disabled={deletingLecture === l.id}
                  >
                    <Ionicons
                      name={deletingLecture === l.id ? 'hourglass-outline' : 'trash-outline'}
                      size={17}
                      color={colors.error[500]}
                    />
                  </TouchableOpacity>
                </View>
              </View>
            </Card>
          ))
        )}
      </ScrollView>

      {/* Edit Modal — exact same as ManageSchedule (edit only, no Add in global view) */}
      <Modal visible={showModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { paddingBottom: spacing.lg + insets.bottom }]}>
            <Text style={styles.modalTitle}>Edit Lecture</Text>

            <Input label="Title / Group" placeholder="e.g. Group A" value={title} onChangeText={setTitle} />

            <Text style={styles.fieldLabel}>Day</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dayPickerModal}>
              {DAYS.map((d) => (
                <TouchableOpacity
                  key={d.value}
                  style={[styles.dayChip, dayOfWeek === d.value && styles.dayChipActive]}
                  onPress={() => setDayOfWeek(d.value)}
                >
                  <Text style={[styles.dayChipText, dayOfWeek === d.value && styles.dayChipTextActive]}>{d.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.timeRow}>
              <View style={{ flex: 1, marginRight: spacing.sm }}>
                <Input label="Start (HH:MM)" placeholder="09:00" value={startTime} onChangeText={setStartTime} />
              </View>
              <View style={{ flex: 1 }}>
                <Input label="End (HH:MM)" placeholder="10:30" value={endTime} onChangeText={setEndTime} />
              </View>
            </View>

            <Input label="Location" placeholder="Room 101" value={location} onChangeText={setLocation} />

            <Text style={styles.fieldLabel}>Type</Text>
            <View style={styles.typeRow}>
              {(['lecture', 'section'] as const).map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[styles.typeBtn, lectureType === t && styles.typeBtnActive]}
                  onPress={() => setLectureType(t)}
                >
                  <Text style={[styles.typeBtnText, lectureType === t && styles.typeBtnTextActive]}>
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalActions}>
              <Button title="Cancel" variant="outline" size="sm" onPress={() => { setShowModal(false); resetForm(); }} style={{ flex: 1, marginRight: spacing.sm }} />
              <Button title="Save" size="sm" onPress={saveLecture} loading={saving} disabled={!title.trim()} style={{ flex: 1 }} />
            </View>
          </View>
        </View>
      </Modal>

      {/* Cancel Lecture Modal */}
      <Modal visible={showCancelModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { paddingBottom: spacing.lg + insets.bottom }]}>
            <Text style={styles.modalTitle}>Cancel Lecture</Text>
            {cancellingItem && (
              <Text style={styles.cancelModalSub}>
                {cancellingItem.title} — {cancellingItem.courseName}
              </Text>
            )}
            <Text style={styles.fieldLabel}>Reason (optional)</Text>
            <Input
              placeholder="e.g. Professor is sick, holiday, etc."
              value={cancelReason}
              onChangeText={setCancelReason}
              multiline
              numberOfLines={3}
              style={{ minHeight: 80, textAlignVertical: 'top' }}
            />
            <View style={styles.modalActions}>
              <Button
                title="Back"
                variant="outline"
                size="sm"
                onPress={() => { setShowCancelModal(false); setCancellingItem(null); setCancelReason(''); }}
                style={{ flex: 1, marginRight: spacing.sm }}
              />
              <Button
                title="Confirm Cancel"
                variant="danger"
                size="sm"
                onPress={confirmCancelLecture}
                loading={cancellingLecture === cancellingItem?.id}
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
  container: { flex: 1, backgroundColor: colors.neutral[50] },

  // ── Day picker ──
  dayPicker: {
    maxHeight: 100, backgroundColor: colors.neutral[0],
    borderBottomWidth: 1, borderBottomColor: colors.neutral[100],
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2,
  },
  dayPickerContent: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.sm },
  dayBtn: {
    minWidth: 72, paddingHorizontal: spacing.sm, paddingVertical: spacing.sm,
    borderRadius: borderRadius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.neutral[50],
  },
  dayBtnActive: { backgroundColor: colors.primary[500] },
  dayBtnToday: { borderWidth: 2, borderColor: colors.primary[300], backgroundColor: colors.primary[50] },
  dayText: { ...typography.captionMedium, color: colors.neutral[600], fontSize: 11, fontWeight: '600', textTransform: 'uppercase' },
  dayTextActive: { color: '#fff' },
  dayTextToday: { color: colors.primary[600] },
  dayDateText: { ...typography.captionMedium, color: colors.neutral[700], fontSize: 12, fontWeight: '600', marginTop: 2 },
  dayDateTextActive: { color: '#fff' },
  dayDateTextToday: { color: colors.primary[700] },
  dayCount: { ...typography.small, color: colors.neutral[400], fontSize: 10, marginTop: 2 },
  dayCountActive: { color: 'rgba(255,255,255,0.8)' },

  // ── Content ──
  content: { padding: spacing.md, paddingBottom: spacing.xxl },

  // ── Lecture card ──
  lectureCard: { marginBottom: spacing.sm },
  cancelledCard: {
    backgroundColor: colors.error[50],
    opacity: 0.85,
    borderLeftWidth: 3,
    borderLeftColor: colors.error[400],
  },
  lectureRow: { flexDirection: 'row', alignItems: 'center' },

  // Time column — vertical, matching Dashboard style
  timeCol: { width: 68, alignItems: 'center' },
  timeText: { ...typography.label, color: colors.primary[600] },
  timeSub: { ...typography.tiny, color: colors.neutral[400] },
  cancelledTimeText: { color: colors.error[500], textDecorationLine: 'line-through' },

  // Vertical divider — same as Dashboard
  timeDivider: {
    width: 3, height: 40, backgroundColor: colors.primary[200],
    borderRadius: 2, marginHorizontal: spacing.sm,
  },
  cancelledDivider: { backgroundColor: colors.error[200] },

  // Lecture details
  lectureInfo: { flex: 1 },
  lectureTitle: { ...typography.bodyMedium, color: colors.neutral[800], marginBottom: 2 },
  cancelledTitle: { color: colors.error[600], textDecorationLine: 'line-through' },
  lecCourseName: { ...typography.caption, color: colors.neutral[500], marginBottom: 4 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  location: { ...typography.caption, color: colors.neutral[400] },
  cancelledBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  cancelledBadgeText: { ...typography.small, color: colors.error[600], fontWeight: '600' },

  // Action row — [Edit] [Cancel] [Delete] — exact same as ManageSchedule
  actionRow: { flexDirection: 'row', gap: 2, marginLeft: spacing.sm },
  actionBtn: {
    width: 32, height: 32, borderRadius: 8, backgroundColor: colors.neutral[50],
    alignItems: 'center', justifyContent: 'center',
  },
  actionBtnCancel: { backgroundColor: colors.error[50] },
  actionBtnReactivate: { backgroundColor: colors.success[50] },

  // ── Edit Modal — exact same as ManageSchedule ──
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: colors.neutral[0], borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: spacing.lg, maxHeight: '90%',
  },
  modalTitle: { ...typography.h3, color: colors.neutral[900], marginBottom: spacing.md },
  fieldLabel: { ...typography.captionMedium, color: colors.neutral[700], marginBottom: 6 },
  dayPickerModal: { marginBottom: spacing.md },
  dayChip: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: borderRadius.full,
    backgroundColor: colors.neutral[100], marginRight: spacing.sm,
  },
  dayChipActive: { backgroundColor: colors.primary[500] },
  dayChipText: { ...typography.captionMedium, color: colors.neutral[600] },
  dayChipTextActive: { color: '#fff' },
  timeRow: { flexDirection: 'row' },
  typeRow: { flexDirection: 'row', marginBottom: spacing.md, gap: spacing.sm },
  typeBtn: {
    flex: 1, paddingVertical: 10, alignItems: 'center',
    borderRadius: borderRadius.md, backgroundColor: colors.neutral[100],
  },
  typeBtnActive: { backgroundColor: colors.primary[500] },
  typeBtnText: { ...typography.captionMedium, color: colors.neutral[600] },
  typeBtnTextActive: { color: '#fff' },
  modalActions: { flexDirection: 'row', marginTop: spacing.sm },
  cancelModalSub: { ...typography.body, color: colors.neutral[600], marginBottom: spacing.md },
  cancelledReason: { ...typography.tiny, color: colors.error[500], marginTop: 2, fontStyle: 'italic' },
});
