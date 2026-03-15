import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { Card, EmptyState, GradesListSkeleton } from '../../components';
import { spacing, typography, borderRadius } from '../../theme';
import { Grade } from '../../types';
import { getGradeColor, formatDate } from '../../lib/helpers';
import { useTheme } from '../../contexts/ThemeContext';

interface ExamSummary {
  examType: string;
  count: number;
  average: number;
  highest: number;
  lowest: number;
  passRate: number;
  passCount: number;
  maxScore: number;
  grades: (Grade & { studentName: string })[];
  distribution: { label: string; count: number; color: string }[];
}

function computeExamSummary(
  grades: (Grade & { studentName: string })[],
  passThreshold = 60,
): ExamSummary[] {
  const byExam: Record<string, (Grade & { studentName: string })[]> = {};
  for (const g of grades) {
    const key = (g as any).exam_name || g.exam_type || 'Unknown';
    if (!byExam[key]) byExam[key] = [];
    byExam[key].push(g);
  }

  return Object.entries(byExam).map(([examType, examGrades]) => {
    const scores = examGrades.map((g) => g.score);
    const maxScore = examGrades[0]?.max_score || 100;
    const average = scores.reduce((a, b) => a + b, 0) / scores.length;
    const highest = Math.max(...scores);
    const lowest = Math.min(...scores);
    const passCount = scores.filter((s) => (s / maxScore) * 100 >= passThreshold).length;
    const passRate = Math.round((passCount / scores.length) * 100);

    const aCount = scores.filter((s) => (s / maxScore) * 100 >= 90).length;
    const bCount = scores.filter((s) => (s / maxScore) * 100 >= 75 && (s / maxScore) * 100 < 90).length;
    const cCount = scores.filter((s) => (s / maxScore) * 100 >= 60 && (s / maxScore) * 100 < 75).length;
    const dCount = scores.filter((s) => (s / maxScore) * 100 < 60).length;

    return {
      examType,
      count: examGrades.length,
      average,
      highest,
      lowest,
      passRate,
      passCount,
      maxScore,
      grades: examGrades,
      distribution: [
        { label: 'A (90%+)', count: aCount, color: '#10B981' },
        { label: 'B (75-89%)', count: bCount, color: '#3B82F6' },
        { label: 'C (60-74%)', count: cCount, color: '#F59E0B' },
        { label: 'F (<60%)', count: dCount, color: '#EF4444' },
      ],
    };
  });
}

const ExamAnalyticsCard = React.memo(({
  summary,
  colors,
  isDark,
  styles,
}: {
  summary: ExamSummary;
  colors: any;
  isDark: boolean;
  styles: ReturnType<typeof makeStyles>;
}) => {
  const [expanded, setExpanded] = useState(false);
  const [showStudents, setShowStudents] = useState(false);

  const avgPct = summary.maxScore > 0 ? (summary.average / summary.maxScore) * 100 : 0;
  const barColor = avgPct >= 75 ? '#10B981' : avgPct >= 60 ? '#F59E0B' : '#EF4444';
  const maxBarCount = Math.max(...summary.distribution.map((d) => d.count), 1);

  return (
    <Card style={styles.examCard}>
      <TouchableOpacity activeOpacity={0.7} onPress={() => setExpanded((v) => !v)}>
        <View style={styles.examCardHeader}>
          <View style={styles.examCardLeft}>
            <Text style={styles.examName}>{summary.examType}</Text>
            <Text style={styles.examMeta}>
              {summary.count} student{summary.count !== 1 ? 's' : ''} · Avg: {summary.average.toFixed(1)}/{summary.maxScore}
            </Text>
          </View>
          <View style={styles.examCardRight}>
            <View style={[styles.passRateBadge, { backgroundColor: summary.passRate >= 60 ? '#10B98115' : '#EF444415' }]}>
              <Text style={[styles.passRateText, { color: summary.passRate >= 60 ? '#059669' : '#DC2626' }]}>
                {summary.passRate}% pass
              </Text>
            </View>
            <Ionicons
              name={expanded ? 'chevron-up' : 'chevron-down'}
              size={16}
              color={colors.neutral[400]}
              style={{ marginTop: 4 }}
            />
          </View>
        </View>
      </TouchableOpacity>

      {expanded && (
        <View style={[styles.analyticsBody, { borderTopColor: isDark ? colors.neutral[700] : colors.neutral[100] }]}>
          {/* Stats row */}
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={[styles.statValue, { color: barColor }]}>{summary.average.toFixed(1)}</Text>
              <Text style={styles.statLabel}>Average</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: colors.neutral[200] }]} />
            <View style={styles.statBox}>
              <Text style={[styles.statValue, { color: '#10B981' }]}>{summary.highest}</Text>
              <Text style={styles.statLabel}>Highest</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: colors.neutral[200] }]} />
            <View style={styles.statBox}>
              <Text style={[styles.statValue, { color: '#EF4444' }]}>{summary.lowest}</Text>
              <Text style={styles.statLabel}>Lowest</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: colors.neutral[200] }]} />
            <View style={styles.statBox}>
              <Text style={[styles.statValue, { color: colors.neutral[700] }]}>{summary.passCount}</Text>
              <Text style={styles.statLabel}>Passed</Text>
            </View>
          </View>

          {/* Average bar */}
          <View style={styles.avgBarSection}>
            <View style={styles.avgBarLabelRow}>
              <Text style={[styles.avgBarLabel, { color: colors.neutral[500] }]}>Class average</Text>
              <Text style={[styles.avgBarPct, { color: barColor }]}>{avgPct.toFixed(0)}%</Text>
            </View>
            <View style={[styles.barTrack, { backgroundColor: isDark ? colors.neutral[700] : colors.neutral[200] }]}>
              <View style={[styles.barFill, { width: `${Math.min(100, avgPct)}%` as any, backgroundColor: barColor }]} />
            </View>
            <View style={styles.barFooter}>
              <Text style={[styles.barFooterText, { color: colors.neutral[400] }]}>0</Text>
              <Text style={[styles.barFooterText, { color: colors.neutral[400] }]}>{summary.maxScore}</Text>
            </View>
          </View>

          {/* Grade distribution */}
          <Text style={[styles.distributionTitle, { color: colors.neutral[600] }]}>Grade Distribution</Text>
          <View style={styles.distributionRows}>
            {summary.distribution.map((d) => (
              <View key={d.label} style={styles.distRow}>
                <Text style={[styles.distLabel, { color: colors.neutral[600] }]}>{d.label}</Text>
                <View style={styles.distBarWrap}>
                  <View
                    style={[
                      styles.distBar,
                      {
                        width: maxBarCount > 0 ? `${(d.count / maxBarCount) * 100}%` as any : '0%',
                        backgroundColor: d.color + '90',
                      },
                    ]}
                  />
                </View>
                <Text style={[styles.distCount, { color: colors.neutral[500] }]}>{d.count}</Text>
              </View>
            ))}
          </View>

          {/* Toggle students list */}
          <TouchableOpacity
            style={[styles.studentsToggle, { borderTopColor: isDark ? colors.neutral[700] : colors.neutral[100] }]}
            onPress={() => setShowStudents((v) => !v)}
          >
            <Ionicons name="people-outline" size={14} color={colors.neutral[500]} />
            <Text style={[styles.studentsToggleText, { color: colors.neutral[500] }]}>
              {showStudents ? 'Hide' : 'Show'} student scores
            </Text>
            <Ionicons
              name={showStudents ? 'chevron-up' : 'chevron-down'}
              size={14}
              color={colors.neutral[400]}
            />
          </TouchableOpacity>

          {showStudents && (
            <View style={styles.studentsList}>
              {summary.grades
                .slice()
                .sort((a, b) => b.score - a.score)
                .map((g) => {
                  const gradeColor = getGradeColor(g.score, g.max_score);
                  return (
                    <View key={g.id} style={[styles.studentRow, { borderBottomColor: isDark ? colors.neutral[800] : colors.neutral[100] }]}>
                      <Text style={[styles.studentNameText, { color: colors.neutral[700] }]}>{g.studentName}</Text>
                      <View style={[styles.miniScoreBadge, { backgroundColor: gradeColor + '15' }]}>
                        <Text style={[styles.miniScoreText, { color: gradeColor }]}>
                          {g.score}{g.max_score ? `/${g.max_score}` : ''}
                        </Text>
                      </View>
                    </View>
                  );
                })}
            </View>
          )}
        </View>
      )}
    </Card>
  );
});

export function ProfGrades({ route }: any) {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors, isDark), [colors, isDark]);
  const { courseId } = route.params;
  const [grades, setGrades] = useState<(Grade & { studentName: string })[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'summary' | 'list'>('summary');

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

  const examSummaries = useMemo(() => computeExamSummary(grades), [grades]);

  const totalStudents = useMemo(() => {
    const ids = new Set(grades.map((g) => g.student_id));
    return ids.size;
  }, [grades]);

  const overallAvg = useMemo(() => {
    if (grades.length === 0) return 0;
    return grades.reduce((a, b) => a + b.score, 0) / grades.length;
  }, [grades]);

  return (
    <View style={styles.container}>
      {/* Toggle */}
      <View style={styles.toggleRow}>
        <TouchableOpacity
          style={[styles.toggleBtn, viewMode === 'summary' && styles.toggleActive]}
          onPress={() => setViewMode('summary')}
        >
          <Ionicons
            name="bar-chart-outline"
            size={14}
            color={viewMode === 'summary' ? colors.primary[600] : colors.neutral[400]}
          />
          <Text style={[styles.toggleText, viewMode === 'summary' && styles.toggleTextActive]}>
            Analytics
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleBtn, viewMode === 'list' && styles.toggleActive]}
          onPress={() => setViewMode('list')}
        >
          <Ionicons
            name="list-outline"
            size={14}
            color={viewMode === 'list' ? colors.primary[600] : colors.neutral[400]}
          />
          <Text style={[styles.toggleText, viewMode === 'list' && styles.toggleTextActive]}>
            All Grades
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <GradesListSkeleton />
      ) : viewMode === 'summary' ? (
        <FlatList
          data={examSummaries}
          keyExtractor={(item) => item.examType}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListHeaderComponent={
            grades.length > 0 ? (
              <View style={[styles.overviewCard, { backgroundColor: isDark ? colors.neutral[800] : colors.primary[50], borderColor: isDark ? colors.neutral[700] : colors.primary[100] }]}>
                <View style={styles.overviewRow}>
                  <View style={styles.overviewItem}>
                    <Ionicons name="people-outline" size={18} color={colors.primary[500]} />
                    <Text style={[styles.overviewValue, { color: colors.neutral[800] }]}>{totalStudents}</Text>
                    <Text style={[styles.overviewLabel, { color: colors.neutral[500] }]}>Students</Text>
                  </View>
                  <View style={[styles.overviewDivider, { backgroundColor: isDark ? colors.neutral[700] : colors.primary[200] }]} />
                  <View style={styles.overviewItem}>
                    <Ionicons name="school-outline" size={18} color={colors.primary[500]} />
                    <Text style={[styles.overviewValue, { color: colors.neutral[800] }]}>{examSummaries.length}</Text>
                    <Text style={[styles.overviewLabel, { color: colors.neutral[500] }]}>Exams</Text>
                  </View>
                  <View style={[styles.overviewDivider, { backgroundColor: isDark ? colors.neutral[700] : colors.primary[200] }]} />
                  <View style={styles.overviewItem}>
                    <Ionicons name="trending-up-outline" size={18} color={colors.primary[500]} />
                    <Text style={[styles.overviewValue, { color: colors.neutral[800] }]}>{overallAvg.toFixed(1)}</Text>
                    <Text style={[styles.overviewLabel, { color: colors.neutral[500] }]}>Overall Avg</Text>
                  </View>
                </View>
              </View>
            ) : null
          }
          ListEmptyComponent={
            <EmptyState icon="school-outline" title="No Grades" message="Grades created via OMR on the web will appear here." />
          }
          renderItem={({ item }) => (
            <ExamAnalyticsCard
              summary={item}
              colors={colors}
              isDark={isDark}
              styles={styles}
            />
          )}
        />
      ) : (
        <FlatList
          data={grades}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <EmptyState icon="school-outline" title="No Grades" message="Grades created via OMR on the web will appear here." />
          }
          renderItem={({ item }) => {
            const gradeColor = getGradeColor(item.score, item.max_score);
            return (
              <Card style={styles.gradeCard}>
                <View style={styles.gradeRow}>
                  <View style={styles.gradeInfo}>
                    <Text style={styles.studentName}>{item.studentName}</Text>
                    <Text style={styles.examType}>{(item as any).exam_name || item.exam_type}</Text>
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
      )}
    </View>
  );
}

const makeStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.neutral[50] },
  toggleRow: {
    flexDirection: 'row',
    backgroundColor: colors.neutral[100],
    margin: spacing.md,
    borderRadius: borderRadius.md,
    padding: 4,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: borderRadius.sm,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  toggleActive: {
    backgroundColor: colors.neutral[0],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  toggleText: { ...typography.captionMedium, color: colors.neutral[400] },
  toggleTextActive: { color: colors.primary[600] },
  list: { paddingHorizontal: spacing.md, paddingBottom: spacing.xxl },
  overviewCard: {
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  overviewRow: { flexDirection: 'row', alignItems: 'center' },
  overviewItem: { flex: 1, alignItems: 'center', gap: 4 },
  overviewDivider: { width: 1, height: 40 },
  overviewValue: { ...typography.h3, fontWeight: '700' },
  overviewLabel: { ...typography.tiny },
  examCard: { marginBottom: spacing.sm },
  examCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  examCardLeft: { flex: 1 },
  examCardRight: { alignItems: 'flex-end', gap: 4 },
  examName: { ...typography.bodyMedium, color: colors.neutral[800] },
  examMeta: { ...typography.caption, color: colors.neutral[500], marginTop: 2 },
  passRateBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: borderRadius.sm,
  },
  passRateText: { fontSize: 12, fontWeight: '600' },
  analyticsBody: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  statBox: { flex: 1, alignItems: 'center' },
  statDivider: { width: 1, height: 36 },
  statValue: { ...typography.h3, fontWeight: '700' },
  statLabel: { ...typography.tiny, color: colors.neutral[500], marginTop: 2 },
  avgBarSection: { marginBottom: spacing.md },
  avgBarLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  avgBarLabel: { ...typography.tiny },
  avgBarPct: { ...typography.tiny, fontWeight: '600' },
  barTrack: { height: 8, borderRadius: 4, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 4 },
  barFooter: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  barFooterText: { fontSize: 10, color: colors.neutral[400] },
  distributionTitle: {
    ...typography.captionMedium,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  distributionRows: { gap: spacing.xs, marginBottom: spacing.md },
  distRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  distLabel: { ...typography.tiny, width: 72 },
  distBarWrap: { flex: 1, height: 10, backgroundColor: isDark ? colors.neutral[700] : colors.neutral[100], borderRadius: 5, overflow: 'hidden' },
  distBar: { height: '100%', borderRadius: 5 },
  distCount: { ...typography.tiny, width: 24, textAlign: 'right' },
  studentsToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
  },
  studentsToggleText: { ...typography.caption, flex: 1 },
  studentsList: { marginTop: spacing.sm },
  studentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
  },
  studentNameText: { ...typography.caption, flex: 1 },
  miniScoreBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: borderRadius.sm },
  miniScoreText: { fontSize: 12, fontWeight: '700' },
  gradeCard: { marginBottom: spacing.sm },
  gradeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  gradeInfo: { flex: 1 },
  studentName: { ...typography.bodyMedium, color: colors.neutral[800] },
  examType: { ...typography.caption, color: colors.neutral[500], marginTop: 2 },
  date: { ...typography.small, color: colors.neutral[400], marginTop: 2 },
  scoreBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: borderRadius.md },
  scoreText: { ...typography.bodyMedium, fontWeight: '700' },
});
