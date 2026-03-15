import React, { useEffect, useState, useCallback, useMemo} from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl, Modal, TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { supabase } from '../../lib/supabase';
import { Card, Button, Badge, EmptyState, Input } from '../../components';
import { colors, spacing, typography, borderRadius } from '../../theme';
import { Lecture } from '../../types';
import { formatTime, getDayName } from '../../lib/helpers';
import { useTheme } from '../../contexts/ThemeContext';

const DAYS = [
  { value: 0, label: 'Sun' }, { value: 1, label: 'Mon' }, { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' }, { value: 4, label: 'Thu' }, { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
];

export function ManageSchedule({ route }: any) {

  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors, isDark), [colors, isDark]);
  const insets = useSafeAreaInsets();
  const { courseId, courseName } = route.params;
  const { profile } = useAuth();
  const { showToast } = useToast();
  const [lectures, setLectures] = useState<Lecture[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingLecture, setEditingLecture] = useState<Lecture | null>(null);
  const [title, setTitle] = useState('');
  const [dayOfWeek, setDayOfWeek] = useState(1);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:30');
  const [location, setLocation] = useState('');
  const [lectureType, setLectureType] = useState<'lecture' | 'section'>('lecture');
  const [saving, setSaving] = useState(false);
  const [cancellingLecture, setCancellingLecture] = useState<string | null>(null);
  const [deletingLecture, setDeletingLecture] = useState<string | null>(null);

  const loadLectures = useCallback(async () => {
    const { data } = await supabase.from('lectures').select('*')
      .eq('course_id', courseId).order('day_of_week').order('start_time');
    setLectures(data || []);
  }, [courseId]);

  useEffect(() => { loadLectures(); }, [loadLectures]);

  const onRefresh = async () => { setRefreshing(true); await loadLectures(); setRefreshing(false); };

  const resetForm = () => {
    setTitle(''); setDayOfWeek(1); setStartTime('09:00'); setEndTime('10:30');
    setLocation(''); setLectureType('lecture'); setEditingLecture(null);
  };

  const openAddModal = () => { resetForm(); setShowModal(true); };

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

  const notifyStudents = async (message: string) => {
    const { data: enrollments } = await supabase
      .from('enrollments').select('student_id').eq('course_id', courseId);
    if (enrollments && enrollments.length > 0) {
      const notifs = enrollments.map((e) => ({
        user_id: e.student_id, title: 'Schedule Update', message, type: 'schedule', link: `/course/${courseId}`,
      }));
      await supabase.from('notifications').insert(notifs);
    }
  };

  const saveLecture = async () => {
    if (!title.trim() || !profile) return;
    setSaving(true);

    if (editingLecture) {
      // Update existing lecture
      const oldDayName = getDayName(editingLecture.day_of_week);
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
        `Lecture "${title.trim()}" has been updated: ${newDayName} ${startTime}-${endTime}`
      );
    } else {
      // Add new lecture
      await supabase.from('lectures').insert({
        course_id: courseId, title: title.trim(), day_of_week: dayOfWeek,
        start_time: startTime + ':00', end_time: endTime + ':00',
        location: location.trim() || null, type: lectureType, created_by: profile.id,
      });
    }

    setSaving(false);
    setShowModal(false);
    resetForm();
    loadLectures();
  };

  // Toggle cancel/reactivate lecture
  const toggleCancelLecture = async (lecture: Lecture) => {
    if (cancellingLecture) return; // Prevent multiple clicks
    
    const action = lecture.is_cancelled ? 'reactivate' : 'cancel';
    setCancellingLecture(lecture.id);
    
    try {
      const { error } = await supabase
        .from('lectures')
        .update({ 
          is_cancelled: !lecture.is_cancelled,
          notification_sent_at: new Date().toISOString(),
        })
        .eq('id', lecture.id);

      if (error) throw error;
      
      await notifyStudents(`Lecture "${lecture.title}" has been ${action === 'cancel' ? 'cancelled' : 'reactivated'}.`);
      showToast(`Lecture ${action === 'cancel' ? 'cancelled' : 'reactivated'}`);
      await loadLectures();
    } catch (err: any) {
      showToast(err.message || `Failed to ${action} lecture`, 'error');
    } finally {
      setCancellingLecture(null);
    }
  };

  const deleteLecture = async (lecture: Lecture) => {
    if (deletingLecture) return; // Prevent multiple clicks
    
    setDeletingLecture(lecture.id);
    
    try {
      await supabase.from('lectures').delete().eq('id', lecture.id);
      await notifyStudents(`Lecture "${lecture.title}" has been removed from the schedule.`);
      showToast('Lecture deleted');
      await loadLectures();
    } catch (error: any) {
      showToast('Failed to delete lecture', 'error');
    } finally {
      setDeletingLecture(null);
    }
  };

  const grouped = lectures.reduce<Record<number, Lecture[]>>((acc, l) => {
    if (!acc[l.day_of_week]) acc[l.day_of_week] = [];
    acc[l.day_of_week].push(l);
    return acc;
  }, {});

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        <TouchableOpacity style={styles.addBtn} onPress={openAddModal}>
          <Ionicons name="add-circle" size={22} color="#fff" />
          <Text style={styles.addBtnText}>Add Lecture</Text>
        </TouchableOpacity>

        {Object.keys(grouped).length === 0 ? (
          <EmptyState icon="calendar-outline" title="No Lectures" message="Add your first lecture to this course." />
        ) : (
          Object.entries(grouped).sort(([a], [b]) => Number(a) - Number(b)).map(([day, lecs]) => (
            <View key={day} style={styles.dayGroup}>
              <Text style={styles.dayTitle}>{getDayName(Number(day))}</Text>
              {lecs.map((l) => (
                <Card key={l.id} style={[styles.lectureCard, l.is_cancelled && styles.cancelledCard]}>
                  <View style={styles.lectureRow}>
                    <View style={styles.lectureInfo}>
                      <Text style={[
                        styles.lectureTitle,
                        l.is_cancelled && styles.cancelledTitle
                      ]}>
                        {l.title}
                      </Text>
                      <Text style={[
                        styles.lectureTime,
                        l.is_cancelled && styles.cancelledText
                      ]}>
                        {formatTime(l.start_time)} - {formatTime(l.end_time)}
                      </Text>
                      <View style={styles.metaRow}>
                        <Badge text={l.type} variant="neutral" />
                        {l.location && <Text style={styles.locationText}>{l.location}</Text>}
                      </View>
                      {l.is_cancelled && (
                        <View style={styles.cancelledBadgeRow}>
                          <Ionicons name="close-circle-outline" size={14} color={colors.error[600]} />
                          <Text style={styles.cancelledBadgeText}>Cancelled</Text>
                        </View>
                      )}
                    </View>

                    {/* Action Buttons — horizontal row, right-aligned */}
                    <View style={styles.actionRow}>
                      <TouchableOpacity style={styles.actionBtn} onPress={() => openEditModal(l)}>
                        <Ionicons name="create-outline" size={17} color={colors.primary[500]} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.actionBtn, styles.actionBtnCancel, l.is_cancelled && styles.actionBtnReactivate]}
                        onPress={() => toggleCancelLecture(l)}
                        disabled={cancellingLecture === l.id}
                      >
                        <Ionicons
                          name={cancellingLecture === l.id ? 'hourglass-outline' : (l.is_cancelled ? 'checkmark-circle-outline' : 'close-circle-outline')}
                          size={17}
                          color={l.is_cancelled ? colors.success[600] : colors.error[500]}
                        />
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.actionBtn} onPress={() => deleteLecture(l)}>
                        <Ionicons name="trash-outline" size={17} color={colors.error[500]} />
                      </TouchableOpacity>
                    </View>
                  </View>
                  
                  {/* Compact icon-only cancel/reactivate button — far right of action col */}
                </Card>
              ))}
            </View>
          ))
        )}
      </ScrollView>

      {/* Add/Edit Modal */}
      <Modal visible={showModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { paddingBottom: spacing.lg + insets.bottom }]}>
            <Text style={styles.modalTitle}>{editingLecture ? 'Edit Lecture' : 'Add Lecture'}</Text>

            <Input label="Title / Group" placeholder="e.g. Group A" value={title} onChangeText={setTitle} />

            <Text style={styles.fieldLabel}>Day</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dayPicker}>
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
              <Button title={editingLecture ? 'Save' : 'Add'} size="sm" onPress={saveLecture} loading={saving} disabled={!title.trim()} style={{ flex: 1 }} />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const makeStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.neutral[50] },
  content: { padding: spacing.md, paddingBottom: spacing.xxl },
  addBtn: {
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
  addBtnText: { ...typography.button, color: '#fff' },
  dayGroup: { marginBottom: spacing.md },
  dayTitle: { ...typography.bodyMedium, color: colors.neutral[600], marginBottom: spacing.sm, fontWeight: '600' },
  lectureCard: { marginBottom: spacing.sm },
  cancelledCard: { 
    backgroundColor: colors.error[50], 
    borderLeftWidth: 4, 
    borderLeftColor: colors.error[500],
    opacity: 0.85,
  },
  lectureRow: { flexDirection: 'row', alignItems: 'center' },
  lectureInfo: { flex: 1 },
  lectureTitle: { ...typography.bodyMedium, color: colors.neutral[800], fontWeight: '600' },
  cancelledTitle: { 
    textDecorationLine: 'line-through',
    color: colors.error[600],
  },
  lectureTime: { ...typography.caption, color: colors.primary[500], marginTop: 2 },
  cancelledText: {
    textDecorationLine: 'line-through',
    color: colors.error[500],
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 4 },
  locationText: { ...typography.caption, color: colors.neutral[400] },
  // Cancelled badge (copied from ProfessorSchedule)
  cancelledBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  cancelledBadgeText: {
    ...typography.small,
    color: colors.error[600],
    fontWeight: '600',
  },
  // Horizontal action row (edit / cancel / delete icons)
  actionRow: { flexDirection: 'row', gap: 2, marginLeft: spacing.sm },
  actionBtn: {
    width: 32, height: 32, borderRadius: 8, backgroundColor: colors.neutral[50],
    alignItems: 'center', justifyContent: 'center',
  },
  actionBtnCancel: {
    backgroundColor: colors.error[50],
  },
  actionBtnReactivate: {
    backgroundColor: colors.success[50],
  },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: colors.neutral[0], borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: spacing.lg, maxHeight: '90%',
  },
  modalTitle: { ...typography.h3, color: colors.neutral[900], marginBottom: spacing.md },
  fieldLabel: { ...typography.captionMedium, color: colors.neutral[700], marginBottom: 6 },
  dayPicker: { marginBottom: spacing.md },
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
    flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: borderRadius.md,
    backgroundColor: colors.neutral[100],
  },
  typeBtnActive: { backgroundColor: colors.primary[500] },
  typeBtnText: { ...typography.captionMedium, color: colors.neutral[600] },
  typeBtnTextActive: { color: '#fff' },
  modalActions: { flexDirection: 'row', marginTop: spacing.sm },
});
