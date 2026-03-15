import React, { useEffect, useState, useCallback, useMemo} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { Card, Badge, Button, EmptyState, Input, ObjectionsSkeleton } from '../../components';
import { colors, spacing, typography, borderRadius } from '../../theme';
import { GradeObjection } from '../../types';
import { formatDate } from '../../lib/helpers';
import { useTheme } from '../../contexts/ThemeContext';

export function ProfObjections({ route }: any) {

  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors, isDark), [colors, isDark]);
  const { courseId } = route.params;
  const { profile } = useAuth();
  const [objections, setObjections] = useState<(GradeObjection & { studentName: string; studentEmail: string })[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selected, setSelected] = useState<GradeObjection | null>(null);
  const [response, setResponse] = useState('');
  const [adjustedScore, setAdjustedScore] = useState('');
  const [actionType, setActionType] = useState<'reject' | 'adjust' | 'approve'>('reject');
  const [submitting, setSubmitting] = useState(false);

  const loadObjections = useCallback(async () => {
    const { data } = await supabase
      .from('grade_objections')
      .select('*')
      .eq('course_id', courseId)
      .order('created_at', { ascending: false });

    if (data && data.length > 0) {
      const studentIds = [...new Set(data.map((o) => o.student_id))];
      const { data: profiles } = await supabase
        .from('user_profiles')
        .select('id, first_name, last_name, email')
        .in('id', studentIds);

      const enriched = data.map((o) => {
        const p = profiles?.find((p) => p.id === o.student_id);
        return { 
          ...o, 
          studentName: p ? `${p.first_name || ''} ${p.last_name || ''}`.trim() : 'Unknown',
          studentEmail: p?.email || ''
        };
      });
      setObjections(enriched);
    } else {
      setObjections([]);
    }
    setLoading(false);
  }, [courseId]);

  useEffect(() => {
    loadObjections();
  }, [loadObjections]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadObjections();
    setRefreshing(false);
  };

  const openAction = (obj: GradeObjection & { studentName: string }, type: 'reject' | 'adjust' | 'approve') => {
    setSelected(obj);
    setActionType(type);
    setResponse('');
    setAdjustedScore('');
    setShowModal(true);
  };

  const handleSubmit = async () => {
    if (!selected || !profile) return;
    setSubmitting(true);

    if (actionType === 'approve') {
      await supabase
        .from('grade_objections')
        .update({
          status: 'approved',
          instructor_response: response.trim() || null,
          reviewed_by: profile.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', selected.id);

      await supabase.from('notifications').insert({
        user_id: selected.student_id,
        title: 'Grade Objection Approved',
        message: `Your objection for "${selected.exam_name}" has been approved.`,
        type: 'grade',
        link: `/course/${selected.course_id}`,
      });
    } else if (actionType === 'reject') {
      await supabase
        .from('grade_objections')
        .update({
          status: 'rejected',
          instructor_response: response.trim() || null,
          reviewed_by: profile.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', selected.id);

      await supabase.from('notifications').insert({
        user_id: selected.student_id,
        title: 'Grade Objection Rejected',
        message: `Your objection for "${selected.exam_name}" has been rejected.`,
        type: 'grade',
        link: `/course/${selected.course_id}`,
      });
    } else {
      const newScore = parseFloat(adjustedScore);
      if (isNaN(newScore)) {
        Alert.alert('Error', 'Please enter a valid score.');
        setSubmitting(false);
        return;
      }

      await supabase
        .from('grade_objections')
        .update({
          status: 'adjusted',
          adjusted_score: newScore,
          instructor_response: response.trim() || null,
          reviewed_by: profile.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', selected.id);

      await supabase
        .from('grades')
        .update({ score: newScore })
        .eq('student_id', selected.student_id)
        .eq('course_id', selected.course_id)
        .eq('exam_type', selected.exam_name);

      await supabase.from('notifications').insert({
        user_id: selected.student_id,
        title: 'Grade Adjusted',
        message: `Your grade for "${selected.exam_name}" has been adjusted to ${newScore}.`,
        type: 'grade',
        link: `/course/${selected.course_id}`,
      });
    }

    setSubmitting(false);
    setShowModal(false);
    loadObjections();
  };

  const getStatusVariant = (s: string) => {
    switch (s) {
      case 'pending': return 'warning';
      case 'approved': return 'success';
      case 'rejected': return 'error';
      case 'adjusted': return 'info';
      default: return 'neutral';
    }
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={objections}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          loading ? <ObjectionsSkeleton /> : <EmptyState icon="flag-outline" title="No Objections" message="No grade objections for this course." />
        }
        renderItem={({ item }) => (
          <Card style={styles.objCard}>
            <View style={styles.objHeader}>
              <View style={styles.objInfo}>
                <Text style={styles.studentName} selectable>{item.studentName}</Text>
                <Text style={styles.studentEmail} selectable>{item.studentEmail}</Text>
                <Text style={styles.examName}>{item.exam_name} - Score: {item.current_grade}</Text>
                <Text style={styles.date}>{formatDate(item.created_at)}</Text>
              </View>
              <Badge text={item.status} variant={getStatusVariant(item.status) as any} />
            </View>
            <Text style={styles.reason} selectable>{item.objection_reason}</Text>
            {item.instructor_response && (
              <View style={styles.responseBox}>
                <Text style={styles.responseLabel}>Your Response:</Text>
                <Text style={styles.responseText} selectable>{item.instructor_response}</Text>
              </View>
            )}
            {item.status === 'pending' && (
              <View style={styles.actionsCol}>
                <View style={styles.actions}>
                  <Button
                    title="Approve"
                    variant="secondary"
                    size="sm"
                    onPress={() => openAction(item, 'approve')}
                    style={{ flex: 1, marginRight: spacing.sm }}
                  />
                  <Button
                    title="Reject"
                    variant="danger"
                    size="sm"
                    onPress={() => openAction(item, 'reject')}
                    style={{ flex: 1 }}
                  />
                </View>
                <Button
                  title="Adjust Score"
                  variant="primary"
                  size="sm"
                  onPress={() => openAction(item, 'adjust')}
                  style={{ marginTop: spacing.sm }}
                />
              </View>
            )}
          </Card>
        )}
      />

      <Modal visible={showModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {actionType === 'approve' ? 'Approve Objection' : actionType === 'reject' ? 'Reject Objection' : 'Adjust Score'}
            </Text>

            {actionType === 'adjust' && (
              <Input
                label="New Score"
                placeholder="Enter adjusted score"
                value={adjustedScore}
                onChangeText={setAdjustedScore}
                keyboardType="decimal-pad"
              />
            )}

            <Text style={styles.fieldLabel}>Response (optional)</Text>
            <TextInput
              style={styles.textArea}
              placeholder="Add a response to the student..."
              value={response}
              onChangeText={setResponse}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              placeholderTextColor={colors.neutral[400]}
            />

            <View style={styles.modalActions}>
              <Button
                title="Cancel"
                variant="outline"
                onPress={() => setShowModal(false)}
                style={{ flex: 1, marginRight: spacing.sm }}
              />
              <Button
                title="Submit"
                onPress={handleSubmit}
                loading={submitting}
                variant={actionType === 'reject' ? 'danger' : actionType === 'approve' ? 'secondary' : 'primary'}
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
  list: { padding: spacing.md, paddingBottom: spacing.xxl },
  objCard: { marginBottom: spacing.sm },
  objHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.sm },
  objInfo: { flex: 1 },
  studentName: { ...typography.bodyMedium, color: colors.neutral[800] },
  studentEmail: { ...typography.caption, color: colors.neutral[500], marginTop: 2 },
  examName: { ...typography.caption, color: colors.neutral[500], marginTop: 2 },
  date: { ...typography.small, color: colors.neutral[400], marginTop: 2 },
  reason: { ...typography.body, color: colors.neutral[600], marginBottom: spacing.sm },
  responseBox: { backgroundColor: colors.neutral[50], padding: spacing.sm, borderRadius: borderRadius.sm, marginBottom: spacing.sm },
  responseLabel: { ...typography.captionMedium, color: colors.neutral[600], marginBottom: 2 },
  responseText: { ...typography.caption, color: colors.neutral[500] },
  actionsCol: { flexDirection: 'column' },
  actions: { flexDirection: 'row' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: colors.neutral[0], borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.lg },
  modalTitle: { ...typography.h3, color: colors.neutral[900], marginBottom: spacing.md },
  fieldLabel: { ...typography.captionMedium, color: colors.neutral[700], marginBottom: 6 },
  textArea: { borderWidth: 1.5, borderColor: colors.neutral[200], borderRadius: borderRadius.md, padding: spacing.md, minHeight: 80, ...typography.body, color: colors.neutral[900], marginBottom: spacing.md },
  modalActions: { flexDirection: 'row' },
});
