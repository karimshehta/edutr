import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  RefreshControl,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  Share,
  Linking,
  Clipboard,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { SUPABASE_URL } from '../../lib/supabase';
import { Card, Badge, Button, EmptyState, GradesListSkeleton } from '../../components';
import { spacing, typography, borderRadius } from '../../theme';
import { Grade, GradeObjection } from '../../types';
import { getGradeColor, formatDate } from '../../lib/helpers';
import { useTheme } from '../../contexts/ThemeContext';

const WEB_APP_BASE = 'https://omrex.app';

interface GradeSection {
  title: string;
  courseId: string;
  data: Grade[];
}

interface GradeAnalytics {
  rank: number;
  totalStudents: number;
  percentile: number;
  topPercentage: number;
  averageScore: number;
  maxScore: number;
}

function computeAnalytics(
  myScore: number,
  allScores: number[],
  maxScore: number,
): GradeAnalytics {
  const sorted = [...allScores].sort((a, b) => b - a);
  const rank = sorted.findIndex((s) => s <= myScore) + 1;
  const total = sorted.length;
  const above = sorted.filter((s) => s < myScore).length;
  const percentile = total > 1 ? Math.round((above / (total - 1)) * 100) : 100;
  const topPct = total > 1 ? Math.round(((rank - 1) / (total - 1)) * 100) : 0;
  const avg = allScores.reduce((a, b) => a + b, 0) / allScores.length;
  return {
    rank: Math.max(1, rank),
    totalStudents: total,
    percentile,
    topPercentage: topPct,
    averageScore: avg,
    maxScore,
  };
}

const GradeInsights = React.memo(({
  analytics,
  colors,
  isDark,
}: {
  analytics: GradeAnalytics;
  colors: any;
  isDark: boolean;
}) => {
  const { score, maxScore, rank, totalStudents, percentile, topPercentage, averageScore } = analytics;
  const scorePct = maxScore > 0 ? (score / maxScore) * 100 : 0;
  const aboveAverage = score >= averageScore;

  const topLabel =
    topPercentage <= 10 ? 'Top 10%' :
    topPercentage <= 25 ? 'Top 25%' :
    topPercentage <= 50 ? 'Top 50%' :
    'Bottom 50%';

  const topBg = topPercentage <= 10
    ? (isDark ? 'rgba(16,185,129,0.15)' : '#ECFDF5')
    : topPercentage <= 25
    ? (isDark ? 'rgba(6,182,212,0.15)' : '#ECFEFF')
    : topPercentage <= 50
    ? (isDark ? 'rgba(245,158,11,0.15)' : '#FFFBEB')
    : (isDark ? 'rgba(100,116,139,0.15)' : '#F8FAFC');

  const topTextColor = topPercentage <= 10
    ? (isDark ? colors.success[400] : colors.success[700])
    : topPercentage <= 25
    ? (isDark ? colors.info[400] : colors.info[700])
    : topPercentage <= 50
    ? (isDark ? colors.warning[400] : colors.warning[700])
    : (isDark ? colors.neutral[400] : colors.neutral[600]);

  const barColor = scorePct >= 75 ? colors.success[500] : scorePct >= 50 ? colors.warning[500] : colors.error[500];
  const scoreColor = scorePct >= 75 ? colors.success[600] : scorePct >= 50 ? colors.warning[600] : colors.error[600];

  return (
    <View style={[insightStyles.container, { backgroundColor: isDark ? colors.neutral[800] : colors.neutral[50], borderColor: isDark ? colors.neutral[700] : colors.neutral[200] }]}>
      <View style={insightStyles.headerRow}>
        <Ionicons name="bar-chart-outline" size={15} color={colors.info[500]} />
        <Text style={[insightStyles.headerLabel, { color: colors.neutral[700] }]}>Your Performance</Text>
      </View>

      {/* 3-stat row */}
      <View style={insightStyles.statsRow}>
        <View style={insightStyles.statCol}>
          <Text style={[insightStyles.statValue, { color: scoreColor }]}>{analytics.score}</Text>
          <Text style={[insightStyles.statSub, { color: colors.neutral[400] }]}>/ {maxScore}</Text>
          <Text style={[insightStyles.statLabel, { color: colors.neutral[500] }]}>Your Score</Text>
        </View>
        <View style={[insightStyles.statDivider, { backgroundColor: colors.neutral[200] }]} />
        <View style={insightStyles.statCol}>
          <Text style={[insightStyles.statValue, { color: colors.neutral[800] }]}>#{rank}</Text>
          <Text style={[insightStyles.statSub, { color: colors.neutral[400] }]}>of {totalStudents}</Text>
          <Text style={[insightStyles.statLabel, { color: colors.neutral[500] }]}>Class Rank</Text>
        </View>
        <View style={[insightStyles.statDivider, { backgroundColor: colors.neutral[200] }]} />
        <View style={insightStyles.statCol}>
          <Text style={[insightStyles.statValue, { color: colors.neutral[800] }]}>{percentile}</Text>
          <Text style={[insightStyles.statSub, { color: colors.neutral[400] }]}>%ile</Text>
          <Text style={[insightStyles.statLabel, { color: colors.neutral[500] }]}>Percentile</Text>
        </View>
      </View>

      {/* Score bar */}
      <View style={insightStyles.barSection}>
        <View style={insightStyles.barLabelRow}>
          <Text style={[insightStyles.barLabel, { color: colors.neutral[500] }]}>Your score</Text>
          <Text style={[insightStyles.barPct, { color: scoreColor }]}>{scorePct.toFixed(0)}%</Text>
        </View>
        <View style={[insightStyles.barTrack, { backgroundColor: isDark ? colors.neutral[700] : colors.neutral[200] }]}>
          <View style={[insightStyles.barFill, { width: `${Math.min(100, scorePct)}%` as any, backgroundColor: barColor }]} />
        </View>
        <View style={insightStyles.barFooter}>
          <Text style={[insightStyles.barFooterText, { color: colors.neutral[400] }]}>0</Text>
          <Text style={[insightStyles.barFooterText, { color: colors.neutral[400] }]}>avg {averageScore.toFixed(1)}</Text>
          <Text style={[insightStyles.barFooterText, { color: colors.neutral[400] }]}>{maxScore}</Text>
        </View>
      </View>

      {/* Bottom row */}
      <View style={insightStyles.bottomRow}>
        <View style={insightStyles.avgRow}>
          <Ionicons
            name={aboveAverage ? 'trending-up' : 'trending-down'}
            size={14}
            color={aboveAverage ? colors.success[500] : colors.warning[500]}
          />
          <Text style={[insightStyles.avgText, { color: colors.neutral[600] }]}>
            {aboveAverage
              ? `${(analytics.score - averageScore).toFixed(1)} above average`
              : `${(averageScore - analytics.score).toFixed(1)} below average`}
          </Text>
        </View>
        <View style={[insightStyles.topBadge, { backgroundColor: topBg }]}>
          <Text style={[insightStyles.topBadgeText, { color: topTextColor }]}>{topLabel}</Text>
        </View>
      </View>

      {/* Footer stats */}
      <View style={[insightStyles.footerStats, { borderTopColor: isDark ? colors.neutral[700] : colors.neutral[200] }]}>
        <View style={insightStyles.footerItem}>
          <Ionicons name="people-outline" size={12} color={colors.neutral[400]} />
          <Text style={[insightStyles.footerText, { color: colors.neutral[400] }]}>{totalStudents} students</Text>
        </View>
        <View style={insightStyles.footerItem}>
          <Ionicons name="ribbon-outline" size={12} color={colors.neutral[400]} />
          <Text style={[insightStyles.footerText, { color: colors.neutral[400] }]}>Class avg: {averageScore.toFixed(1)} / {maxScore}</Text>
        </View>
      </View>
    </View>
  );
});

const insightStyles = StyleSheet.create({
  container: {
    marginTop: spacing.sm,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    padding: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: spacing.md,
  },
  headerLabel: {
    ...typography.captionMedium,
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  statCol: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    height: 40,
  },
  statValue: {
    ...typography.h3,
    fontWeight: '700',
  },
  statSub: {
    ...typography.tiny,
    marginTop: 1,
  },
  statLabel: {
    ...typography.tiny,
    marginTop: 2,
  },
  barSection: {
    marginBottom: spacing.md,
  },
  barLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  barLabel: {
    ...typography.tiny,
  },
  barPct: {
    ...typography.tiny,
    fontWeight: '600',
  },
  barTrack: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 4,
  },
  barFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  barFooterText: {
    fontSize: 10,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  avgRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  avgText: {
    ...typography.tiny,
  },
  topBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: borderRadius.sm,
  },
  topBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  footerStats: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
  },
  footerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  footerText: {
    fontSize: 11,
  },
});

const GradeCard = React.memo(({
  item,
  onObjectPress,
  onSharePress,
  analytics,
  colors,
  isDark,
  styles,
}: {
  item: Grade;
  onObjectPress: () => void;
  onSharePress: () => void;
  analytics: GradeAnalytics | null;
  colors: any;
  isDark: boolean;
  styles: ReturnType<typeof makeStyles>;
}) => {
  const gradeColor = useMemo(() => getGradeColor(item.score, item.max_score), [item.score, item.max_score]);
  const [expanded, setExpanded] = useState(false);
  const shareToken = (item as any).result_share_token as string | undefined;

  return (
    <Card style={styles.gradeCard}>
      <TouchableOpacity
        activeOpacity={analytics ? 0.7 : 1}
        onPress={analytics ? () => setExpanded(v => !v) : undefined}
      >
        <View style={styles.gradeRow}>
          <View style={styles.gradeInfo}>
            <Text style={styles.examType}>{(item as any).exam_name || item.exam_type}</Text>
            <Text style={styles.gradeDate}>{formatDate(item.published_at)}</Text>
          </View>
          <View style={styles.gradeRight}>
            <View style={[styles.scoreBadge, { backgroundColor: gradeColor + '15' }]}>
              <Text style={[styles.scoreText, { color: gradeColor }]}>
                {item.score}{item.max_score ? `/${item.max_score}` : ''}
              </Text>
            </View>
            {analytics && (
              <Ionicons
                name={expanded ? 'chevron-up' : 'chevron-down'}
                size={16}
                color={colors.neutral[400]}
                style={{ marginTop: 4 }}
              />
            )}
          </View>
        </View>
      </TouchableOpacity>

      {expanded && analytics && (
        <GradeInsights analytics={analytics} colors={colors} isDark={isDark} />
      )}

      <View style={styles.cardActions}>
        <TouchableOpacity style={styles.objectBtn} onPress={onObjectPress}>
          <Ionicons name="flag-outline" size={14} color={colors.neutral[400]} />
          <Text style={styles.objectBtnText}>File Objection</Text>
        </TouchableOpacity>
        {shareToken ? (
          <TouchableOpacity style={styles.shareBtn} onPress={onSharePress}>
            <Ionicons name="share-social-outline" size={14} color={colors.info[600]} />
            <Text style={styles.shareBtnText}>Share Result</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </Card>
  );
});

export function StudentGrades() {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors, isDark), [colors, isDark]);
  const { profile } = useAuth();
  const [sections, setSections] = useState<GradeSection[]>([]);
  const [objections, setObjections] = useState<GradeObjection[]>([]);
  const [gradeAnalytics, setGradeAnalytics] = useState<Record<string, GradeAnalytics>>({});
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showObjection, setShowObjection] = useState(false);
  const [selectedGrade, setSelectedGrade] = useState<Grade | null>(null);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [viewMode, setViewMode] = useState<'grades' | 'objections'>('grades');
  const [shareGrade, setShareGrade] = useState<Grade | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  const loadData = useCallback(async () => {
    if (!profile) return;

    const { data: grades } = await supabase
      .from('grades')
      .select('*')
      .eq('student_id', profile.id)
      .eq('is_published', true)
      .order('published_at', { ascending: false });

    const courseIds = [...new Set((grades || []).map((g) => g.course_id))];
    let courseMap: Record<string, string> = {};

    if (courseIds.length > 0) {
      const { data: courses } = await supabase
        .from('courses')
        .select('id, name')
        .in('id', courseIds);
      courseMap = (courses || []).reduce((acc, c) => ({ ...acc, [c.id]: c.name }), {});
    }

    const grouped: Record<string, Grade[]> = {};
    (grades || []).forEach((g) => {
      if (!grouped[g.course_id]) grouped[g.course_id] = [];
      grouped[g.course_id].push(g);
    });

    const sectionData: GradeSection[] = Object.entries(grouped).map(([cid, gs]) => ({
      title: courseMap[cid] || 'Unknown Course',
      courseId: cid,
      data: gs,
    }));
    setSections(sectionData);

    const { data: objData } = await supabase
      .from('grade_objections')
      .select('*')
      .eq('student_id', profile.id)
      .order('created_at', { ascending: false });
    setObjections(objData || []);

    // Load class-wide analytics for each grade
    const analyticsMap: Record<string, GradeAnalytics> = {};
    const examKeys = new Set<string>();

    for (const g of grades || []) {
      const key = `${g.course_id}__${(g as any).exam_name || g.exam_type}`;
      examKeys.add(key);
    }

    for (const key of examKeys) {
      const [courseId, examName] = key.split('__');
      const { data: classGrades } = await supabase
        .from('grades')
        .select('score, max_score, student_id')
        .eq('course_id', courseId)
        .eq('is_published', true)
        .or(`exam_name.eq.${examName},exam_type.eq.${examName}`);

      if (classGrades && classGrades.length > 1) {
        const allScores = classGrades.map((cg) => cg.score);
        const myGrade = (grades || []).find(
          (g) => g.course_id === courseId && ((g as any).exam_name || g.exam_type) === examName
        );
        if (myGrade) {
          const maxScore = myGrade.max_score || Math.max(...allScores);
          const analytics = computeAnalytics(myGrade.score, allScores, maxScore);
          // Store analytics by grade id
          const matchingGrades = (grades || []).filter(
            (g) => g.course_id === courseId && ((g as any).exam_name || g.exam_type) === examName
          );
          for (const mg of matchingGrades) {
            analyticsMap[mg.id] = { ...analytics, score: mg.score };
          }
        }
      }
    }
    setGradeAnalytics(analyticsMap);
    setLoading(false);
  }, [profile]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const openObjectionModal = useCallback((grade: Grade) => {
    const existing = objections.find(
      (o) => o.course_id === grade.course_id && o.exam_name === ((grade as any).exam_name || grade.exam_type)
    );

    if (existing) {
      Alert.alert('Already Filed', 'You have already submitted an objection for this grade.');
      return;
    }

    setSelectedGrade(grade);
    setReason('');
    setShowObjection(true);
  }, [objections]);

  const submitObjection = async () => {
    if (!selectedGrade || !reason.trim() || !profile) return;
    setSubmitting(true);
    await supabase.from('grade_objections').insert({
      student_id: profile.id,
      course_id: selectedGrade.course_id,
      instructor_id: selectedGrade.published_by,
      exam_name: selectedGrade.exam_type,
      current_grade: selectedGrade.score,
      objection_reason: reason.trim(),
      status: 'pending',
    });
    setSubmitting(false);
    setShowObjection(false);
    loadData();
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

  const getShareUrl = useCallback((grade: Grade): string => {
    const token = (grade as any).result_share_token;
    if (!token) return '';
    return `${WEB_APP_BASE}/result/${token}`;
  }, []);

  const handleNativeShare = useCallback(async (grade: Grade) => {
    const url = getShareUrl(grade);
    if (!url) return;
    const examName = (grade as any).exam_name || grade.exam_type;
    try {
      await Share.share({
        message: `Check my exam result for ${examName}! 🎓\n${url}`,
        url,
        title: `My Exam Result - ${examName}`,
      });
    } catch {
      // User cancelled
    }
  }, [getShareUrl]);

  const handleWhatsApp = useCallback(async (grade: Grade) => {
    const url = getShareUrl(grade);
    if (!url) return;
    const examName = (grade as any).exam_name || grade.exam_type;
    const text = encodeURIComponent(`Check my exam result for ${examName}! 🎓\n${url}`);
    const waUrl = `whatsapp://send?text=${text}`;
    const canOpen = await Linking.canOpenURL(waUrl);
    if (canOpen) {
      await Linking.openURL(waUrl);
    } else {
      await Linking.openURL(`https://wa.me/?text=${text}`);
    }
  }, [getShareUrl]);

  const handleFacebook = useCallback(async (grade: Grade) => {
    const url = getShareUrl(grade);
    if (!url) return;
    const fbUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
    await Linking.openURL(fbUrl);
  }, [getShareUrl]);

  const handleCopyLink = useCallback((grade: Grade) => {
    const url = getShareUrl(grade);
    if (!url) return;
    Clipboard.setString(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  }, [getShareUrl]);

  const handleViewResult = useCallback(async (grade: Grade) => {
    const url = getShareUrl(grade);
    if (!url) return;
    await Linking.openURL(url);
  }, [getShareUrl]);

  const keyExtractor = useCallback((item: Grade) => item.id, []);
  const renderItem = useCallback(({ item }: { item: Grade }) => (
    <GradeCard
      item={item}
      onObjectPress={() => openObjectionModal(item)}
      onSharePress={() => setShareGrade(item)}
      analytics={gradeAnalytics[item.id] || null}
      colors={colors}
      isDark={isDark}
      styles={styles}
    />
  ), [openObjectionModal, gradeAnalytics, colors, isDark, styles]);

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.toggleRow}>
          <TouchableOpacity style={[styles.toggleBtn, styles.toggleActive]}>
            <Text style={[styles.toggleText, styles.toggleTextActive]}>Grades</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.toggleBtn}>
            <Text style={styles.toggleText}>Objections</Text>
          </TouchableOpacity>
        </View>
        <GradesListSkeleton />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.toggleRow}>
        <TouchableOpacity
          style={[styles.toggleBtn, viewMode === 'grades' && styles.toggleActive]}
          onPress={() => setViewMode('grades')}
        >
          <Text style={[styles.toggleText, viewMode === 'grades' && styles.toggleTextActive]}>Grades</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleBtn, viewMode === 'objections' && styles.toggleActive]}
          onPress={() => setViewMode('objections')}
        >
          <Text style={[styles.toggleText, viewMode === 'objections' && styles.toggleTextActive]}>
            Objections {objections.length > 0 ? `(${objections.length})` : ''}
          </Text>
        </TouchableOpacity>
      </View>

      {viewMode === 'grades' ? (
        <SectionList
          sections={sections}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          renderSectionHeader={({ section }) => (
            <Text style={styles.sectionHeader}>{section.title}</Text>
          )}
          renderItem={renderItem}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={10}
          removeClippedSubviews={true}
          ListEmptyComponent={
            <EmptyState icon="school-outline" title="No Grades" message="No published grades yet." />
          }
        />
      ) : (
        <SectionList
          sections={[{ title: '', data: objections }]}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          renderSectionHeader={() => null}
          renderItem={({ item }) => (
            <Card style={styles.gradeCard}>
              <View style={styles.objRow}>
                <View style={styles.gradeInfo}>
                  <Text style={styles.examType}>{item.exam_name}</Text>
                  <Text style={styles.gradeDate}>
                    Grade: {item.current_grade} - {formatDate(item.created_at)}
                  </Text>
                </View>
                <Badge text={item.status} variant={getStatusVariant(item.status) as any} />
              </View>
              <Text style={styles.objReason} numberOfLines={2}>{item.objection_reason}</Text>
              {item.instructor_response && (
                <View style={styles.responseBox}>
                  <Text style={styles.responseLabel}>Response:</Text>
                  <Text style={styles.responseText}>{item.instructor_response}</Text>
                </View>
              )}
              {item.adjusted_score !== null && (
                <Text style={styles.adjustedText}>Adjusted score: {item.adjusted_score}</Text>
              )}
            </Card>
          )}
          ListEmptyComponent={
            <EmptyState icon="flag-outline" title="No Objections" message="You have not filed any grade objections." />
          }
        />
      )}

      <Modal visible={showObjection} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>File Grade Objection</Text>
            {selectedGrade && (
              <Text style={styles.modalSubtitle}>
                {selectedGrade.exam_type} - Score: {selectedGrade.score}
              </Text>
            )}
            <TextInput
              style={styles.textArea}
              placeholder="Explain why you are objecting to this grade..."
              value={reason}
              onChangeText={setReason}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              placeholderTextColor={colors.neutral[400]}
            />
            <View style={styles.modalActions}>
              <Button
                title="Cancel"
                variant="outline"
                onPress={() => setShowObjection(false)}
                style={{ flex: 1, marginRight: spacing.sm }}
              />
              <Button
                title="Submit"
                onPress={submitObjection}
                loading={submitting}
                disabled={!reason.trim()}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Share Result Modal */}
      <Modal visible={!!shareGrade} animationType="slide" transparent onRequestClose={() => setShareGrade(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.shareHeader}>
              <View>
                <Text style={styles.modalTitle}>Share Result</Text>
                {shareGrade && (
                  <Text style={styles.shareSubtitle}>
                    {(shareGrade as any).exam_name || shareGrade.exam_type} · Score: {shareGrade.score}{shareGrade.max_score ? `/${shareGrade.max_score}` : ''}
                  </Text>
                )}
              </View>
              <TouchableOpacity onPress={() => setShareGrade(null)} style={styles.closeBtn}>
                <Ionicons name="close" size={22} color={colors.neutral[500]} />
              </TouchableOpacity>
            </View>

            {/* URL bar */}
            {shareGrade && (
              <View style={[styles.urlBar, { backgroundColor: isDark ? colors.neutral[800] : colors.neutral[100] }]}>
                <Text style={[styles.urlText, { color: colors.neutral[600] }]} numberOfLines={1} ellipsizeMode="middle">
                  {getShareUrl(shareGrade)}
                </Text>
              </View>
            )}

            {/* Action grid */}
            <View style={styles.shareGrid}>
              <TouchableOpacity
                style={[styles.shareActionBtn, { backgroundColor: '#25D366' + '15' }]}
                onPress={() => shareGrade && handleWhatsApp(shareGrade)}
              >
                <View style={[styles.shareActionIcon, { backgroundColor: '#25D366' }]}>
                  <Ionicons name="logo-whatsapp" size={22} color="#fff" />
                </View>
                <Text style={[styles.shareActionLabel, { color: colors.neutral[700] }]}>WhatsApp</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.shareActionBtn, { backgroundColor: '#1877F2' + '15' }]}
                onPress={() => shareGrade && handleFacebook(shareGrade)}
              >
                <View style={[styles.shareActionIcon, { backgroundColor: '#1877F2' }]}>
                  <Ionicons name="logo-facebook" size={22} color="#fff" />
                </View>
                <Text style={[styles.shareActionLabel, { color: colors.neutral[700] }]}>Facebook</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.shareActionBtn, { backgroundColor: colors.primary[50] }]}
                onPress={() => shareGrade && handleViewResult(shareGrade)}
              >
                <View style={[styles.shareActionIcon, { backgroundColor: colors.primary[600] }]}>
                  <Ionicons name="open-outline" size={22} color="#fff" />
                </View>
                <Text style={[styles.shareActionLabel, { color: colors.neutral[700] }]}>View Result</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.shareActionBtn, { backgroundColor: copiedLink ? colors.success[50] : colors.neutral[100] }]}
                onPress={() => shareGrade && handleCopyLink(shareGrade)}
              >
                <View style={[styles.shareActionIcon, { backgroundColor: copiedLink ? colors.success[500] : colors.neutral[400] }]}>
                  <Ionicons name={copiedLink ? 'checkmark' : 'copy-outline'} size={22} color="#fff" />
                </View>
                <Text style={[styles.shareActionLabel, { color: copiedLink ? colors.success[600] : colors.neutral[700] }]}>
                  {copiedLink ? 'Copied!' : 'Copy Link'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Native share sheet */}
            <TouchableOpacity
              style={[styles.nativeShareBtn, { backgroundColor: colors.primary[600] }]}
              onPress={() => shareGrade && handleNativeShare(shareGrade)}
            >
              <Ionicons name="share-outline" size={18} color="#fff" />
              <Text style={styles.nativeShareText}>More Options</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  toggleBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: borderRadius.sm },
  toggleActive: { backgroundColor: colors.neutral[0], shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 2, elevation: 1 },
  toggleText: { ...typography.captionMedium, color: colors.neutral[400] },
  toggleTextActive: { color: colors.primary[600] },
  listContent: { paddingHorizontal: spacing.md, paddingBottom: spacing.xxl },
  sectionHeader: { ...typography.bodyMedium, color: colors.neutral[600], marginTop: spacing.md, marginBottom: spacing.sm },
  gradeCard: { marginBottom: spacing.sm },
  gradeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  gradeRight: { alignItems: 'flex-end' },
  gradeInfo: { flex: 1 },
  examType: { ...typography.bodyMedium, color: colors.neutral[800] },
  gradeDate: { ...typography.small, color: colors.neutral[400], marginTop: 2 },
  scoreBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: borderRadius.md },
  scoreText: { ...typography.bodyMedium, fontWeight: '700' },
  cardActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.sm },
  objectBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  objectBtnText: { ...typography.small, color: colors.neutral[400] },
  shareBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: borderRadius.sm, backgroundColor: isDark ? 'rgba(6,182,212,0.12)' : '#ECFEFF' },
  shareBtnText: { ...typography.tiny, color: isDark ? colors.info[400] : colors.info[600], fontWeight: '600' },
  objRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  objReason: { ...typography.caption, color: colors.neutral[500], marginTop: spacing.sm },
  responseBox: { backgroundColor: colors.neutral[50], padding: spacing.sm, borderRadius: borderRadius.sm, marginTop: spacing.sm },
  responseLabel: { ...typography.captionMedium, color: colors.neutral[600], marginBottom: 2 },
  responseText: { ...typography.caption, color: colors.neutral[500] },
  adjustedText: { ...typography.captionMedium, color: colors.info[600], marginTop: spacing.xs },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: colors.neutral[0], borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.lg },
  modalTitle: { ...typography.h3, color: colors.neutral[900], marginBottom: 4 },
  modalSubtitle: { ...typography.caption, color: colors.neutral[400], marginBottom: spacing.md },
  textArea: {
    borderWidth: 1.5,
    borderColor: colors.neutral[200],
    borderRadius: borderRadius.md,
    padding: spacing.md,
    minHeight: 100,
    ...typography.body,
    color: colors.neutral[900],
    marginBottom: spacing.md,
  },
  modalActions: { flexDirection: 'row' },
  shareHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.md },
  shareSubtitle: { ...typography.caption, color: colors.neutral[500], marginTop: 2 },
  closeBtn: { padding: 4 },
  urlBar: { borderRadius: borderRadius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, marginBottom: spacing.lg },
  urlText: { ...typography.small, fontFamily: 'monospace' },
  shareGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg },
  shareActionBtn: { width: '47%', flexGrow: 1, alignItems: 'center', paddingVertical: spacing.md, borderRadius: borderRadius.lg, gap: spacing.xs },
  shareActionIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  shareActionLabel: { ...typography.tiny, fontWeight: '600', textAlign: 'center' },
  nativeShareBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingVertical: spacing.md, borderRadius: borderRadius.lg },
  nativeShareText: { ...typography.bodyMedium, color: '#fff', fontWeight: '600' },
});
