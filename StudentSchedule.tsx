import React, { useEffect, useState, useCallback, useMemo} from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { supabase } from '../../lib/supabase';
import { Card, EmptyState, GradesListSkeleton } from '../../components';
import { colors, spacing, typography, borderRadius } from '../../theme';
import { Grade, UserProfile } from '../../types';
import { getGradeColor, formatDate } from '../../lib/helpers';
import { useTheme } from '../../contexts/ThemeContext';

export function ProfGrades({ route }: any) {

  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors, isDark), [colors, isDark]);
  const { courseId } = route.params;
  const [grades, setGrades] = useState<(Grade & { studentName: string })[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadGrades = useCallback(async () => {
    const { data } = await supabase
      .from('grades')
      .select('*')
      .eq('course_id', courseId)
      .order('published_at', { ascending: false });

    if (data && data.length > 0) {
      const studentIds = [...new Set(data.map((g) => g.student_id))];
      const { data: profiles } = await supabase
        .from('user_profiles')
        .select('id, first_name, last_name')
        .in('id', studentIds);

      const enriched = data.map((g) => {
        const p = profiles?.find((p) => p.id === g.student_id);
        return {
          ...g,
          studentName: p ? `${p.first_name || ''} ${p.last_name || ''}`.trim() : 'Unknown',
        };
      });
      setGrades(enriched);
    } else {
      setGrades([]);
    }
    setLoading(false);
  }, [courseId]);

  useEffect(() => {
    loadGrades();
  }, [loadGrades]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadGrades();
    setRefreshing(false);
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={grades}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          loading ? <GradesListSkeleton /> : <EmptyState icon="school-outline" title="No Grades" message="Grades created via OMR on the web will appear here." />
        }
        renderItem={({ item }) => {
          const gradeColor = getGradeColor(item.score, item.max_score);
          return (
            <Card style={styles.gradeCard}>
              <View style={styles.gradeRow}>
                <View style={styles.gradeInfo}>
                  <Text style={styles.studentName}>{item.studentName}</Text>
                  <Text style={styles.examType}>{item.exam_type}</Text>
                  <Text style={styles.date}>{formatDate(item.published_at)}</Text>
                </View>
                <View style={[styles.scoreBadge, { backgroundColor: gradeColor + '15' }]}>
                  <Text style={[styles.scoreText, { color: gradeColor }]}>
                    {item.score}{item.max_score ? `/${item.max_score}` : ''}
                  </Text>
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
  list: { padding: spacing.md, paddingBottom: spacing.xxl },
  gradeCard: { marginBottom: spacing.sm },
  gradeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  gradeInfo: { flex: 1 },
  studentName: { ...typography.bodyMedium, color: colors.neutral[800] },
  examType: { ...typography.caption, color: colors.neutral[500], marginTop: 2 },
  date: { ...typography.small, color: colors.neutral[400], marginTop: 2 },
  scoreBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: borderRadius.md },
  scoreText: { ...typography.bodyMedium, fontWeight: '700' },
});
