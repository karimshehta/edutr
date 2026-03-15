import React from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { colors, spacing, borderRadius } from '../theme';
import { useTheme } from '../contexts/ThemeContext';

// ─── Shimmer hook ─────────────────────────────────────────────────────────────
const useShimmer = () => {
  const anim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 900, useNativeDriver: true }),
      ])
    ).start();
  }, [anim]);

  return anim.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.75] });
};

// ─── Base skeleton box ────────────────────────────────────────────────────────
interface SkeletonBoxProps {
  width?: number | string;
  height: number;
  style?: any;
  radius?: number;
}

const SkeletonBox: React.FC<SkeletonBoxProps> = ({ width = '100%', height, style, radius }) => {
  const { isDark } = useTheme();
  const opacity = useShimmer();
  const bg = isDark ? '#334155' : colors.neutral[200];

  return (
    <Animated.View
      style={[
        { backgroundColor: bg, borderRadius: radius ?? borderRadius.sm, width, height, opacity },
        style,
      ]}
    />
  );
};

// ─── Public skeleton components ───────────────────────────────────────────────

export const CardSkeleton: React.FC = () => {
  const { isDark } = useTheme();
  return (
    <View style={[styles.cardSkeleton, { backgroundColor: isDark ? '#1E293B' : colors.neutral[0] }]}>
      <View style={styles.cardHeader}>
        <SkeletonBox width={60} height={22} radius={borderRadius.full} />
        <SkeletonBox width={80} height={22} radius={borderRadius.full} />
      </View>
      <SkeletonBox width="70%" height={18} style={{ marginBottom: spacing.xs }} />
      <SkeletonBox width="90%" height={14} style={{ marginBottom: spacing.sm }} />
      <View style={styles.cardFooter}>
        <SkeletonBox width={100} height={13} />
        <SkeletonBox width={120} height={13} />
      </View>
    </View>
  );
};

export const ListSkeleton: React.FC<{ count?: number }> = ({ count = 3 }) => (
  <View style={styles.listSkeleton}>
    {Array.from({ length: count }).map((_, i) => <CardSkeleton key={i} />)}
  </View>
);

export const StatsCardSkeleton: React.FC = () => {
  const { isDark } = useTheme();
  return (
    <View style={[styles.statsCard, { backgroundColor: isDark ? '#1E293B' : colors.neutral[0] }]}>
      <SkeletonBox width={44} height={44} style={styles.iconCircle} radius={borderRadius.full} />
      <View style={styles.statsContent}>
        <SkeletonBox width="70%" height={22} style={{ marginBottom: spacing.xxs }} />
        <SkeletonBox width="50%" height={13} />
      </View>
    </View>
  );
};

export const StatsGridSkeleton: React.FC = () => (
  <View style={styles.statsGrid}>
    <StatsCardSkeleton /><StatsCardSkeleton /><StatsCardSkeleton />
  </View>
);

export const LectureCardSkeleton: React.FC = () => {
  const { isDark } = useTheme();
  return (
    <View style={[styles.lectureCard, { backgroundColor: isDark ? '#1E293B' : colors.neutral[0] }]}>
      <View style={styles.lectureTime}>
        <SkeletonBox width={50} height={15} />
        <SkeletonBox width={70} height={13} style={{ marginTop: spacing.xs }} />
      </View>
      <View style={[styles.lectureDivider, { backgroundColor: isDark ? '#334155' : colors.neutral[200] }]} />
      <View style={styles.lectureInfo}>
        <SkeletonBox width="80%" height={17} style={{ marginBottom: spacing.xs }} />
        <SkeletonBox width="60%" height={13} />
      </View>
    </View>
  );
};

export const ScheduleSkeleton: React.FC = () => (
  <View style={styles.scheduleSkeleton}>
    {Array.from({ length: 3 }).map((_, i) => (
      <View key={i} style={styles.dayGroup}>
        <SkeletonBox width={120} height={17} style={{ marginBottom: spacing.md }} />
        <LectureCardSkeleton /><LectureCardSkeleton />
      </View>
    ))}
  </View>
);

export const MaterialCardSkeleton: React.FC = () => {
  const { isDark } = useTheme();
  return (
    <View style={[styles.materialCard, { backgroundColor: isDark ? '#1E293B' : colors.neutral[0] }]}>
      <View style={styles.materialRow}>
        <SkeletonBox width={40} height={40} style={styles.fileIcon} radius={borderRadius.md} />
        <View style={styles.materialInfo}>
          <SkeletonBox width="70%" height={15} style={{ marginBottom: spacing.xs }} />
          <SkeletonBox width="50%" height={13} />
        </View>
      </View>
      <View style={styles.materialActions}>
        <SkeletonBox width={30} height={30} style={styles.actionBtn} radius={borderRadius.sm} />
        <SkeletonBox width={30} height={30} style={styles.actionBtn} radius={borderRadius.sm} />
      </View>
    </View>
  );
};

export const ProfileSkeleton: React.FC = () => (
  <View style={styles.profileSkeleton}>
    <View style={styles.profileHeader}>
      <SkeletonBox width={100} height={100} style={styles.avatar} radius={borderRadius.full} />
      <SkeletonBox width="60%" height={22} style={{ marginTop: spacing.md }} />
      <SkeletonBox width="40%" height={15} style={{ marginTop: spacing.xs }} />
    </View>
    <View style={styles.profileInfo}>
      <SkeletonBox width="100%" height={50} style={{ marginBottom: spacing.md }} />
      <SkeletonBox width="100%" height={50} style={{ marginBottom: spacing.md }} />
      <SkeletonBox width="100%" height={50} />
    </View>
  </View>
);

export const GradeRowSkeleton: React.FC = () => {
  const { isDark } = useTheme();
  return (
    <View style={[styles.gradeRow, { backgroundColor: isDark ? '#1E293B' : colors.neutral[0] }]}>
      <View style={styles.gradeLeft}>
        <SkeletonBox width="70%" height={15} style={{ marginBottom: spacing.xs }} />
        <SkeletonBox width="50%" height={13} />
      </View>
      <SkeletonBox width={60} height={30} style={styles.gradeBadge} radius={borderRadius.md} />
    </View>
  );
};

export const GradesListSkeleton: React.FC = () => (
  <View style={styles.gradesListSkeleton}>
    {Array.from({ length: 5 }).map((_, i) => <GradeRowSkeleton key={i} />)}
  </View>
);

export const StudentRowSkeleton: React.FC = () => {
  const { isDark } = useTheme();
  return (
    <View style={[styles.studentRow, { backgroundColor: isDark ? '#1E293B' : colors.neutral[0] }]}>
      <SkeletonBox width={44} height={44} style={styles.studentAvatar} radius={borderRadius.full} />
      <View style={styles.studentInfo}>
        <SkeletonBox width="60%" height={15} style={{ marginBottom: spacing.xs }} />
        <SkeletonBox width="40%" height={12} />
      </View>
      <SkeletonBox width={70} height={28} radius={borderRadius.md} />
    </View>
  );
};

export const StudentsListSkeleton: React.FC<{ count?: number }> = ({ count = 5 }) => (
  <View style={styles.studentListSkeleton}>
    {Array.from({ length: count }).map((_, i) => <StudentRowSkeleton key={i} />)}
  </View>
);

export const SessionCardSkeleton: React.FC = () => {
  const { isDark } = useTheme();
  return (
    <View style={[styles.sessionCard, { backgroundColor: isDark ? '#1E293B' : colors.neutral[0] }]}>
      <View style={styles.sessionHeader}>
        <SkeletonBox width="50%" height={15} />
        <SkeletonBox width={60} height={22} radius={borderRadius.full} />
      </View>
      <SkeletonBox width="70%" height={13} style={{ marginBottom: spacing.xs }} />
      <SkeletonBox width="40%" height={12} />
    </View>
  );
};

export const AttendanceSkeleton: React.FC = () => (
  <View style={styles.sessionSkeleton}>
    <SessionCardSkeleton /><SessionCardSkeleton /><SessionCardSkeleton />
  </View>
);

export const ObjectionCardSkeleton: React.FC = () => {
  const { isDark } = useTheme();
  return (
    <View style={[styles.objectionCard, { backgroundColor: isDark ? '#1E293B' : colors.neutral[0] }]}>
      <View style={styles.sessionHeader}>
        <SkeletonBox width="50%" height={15} />
        <SkeletonBox width={70} height={22} radius={borderRadius.full} />
      </View>
      <SkeletonBox width="80%" height={13} style={{ marginBottom: spacing.xs }} />
      <SkeletonBox width="60%" height={12} style={{ marginBottom: spacing.sm }} />
      <SkeletonBox width="90%" height={12} />
    </View>
  );
};

export const ObjectionsSkeleton: React.FC = () => (
  <View style={styles.objectionSkeleton}>
    {Array.from({ length: 4 }).map((_, i) => <ObjectionCardSkeleton key={i} />)}
  </View>
);

export const ProfDashboardSkeleton: React.FC = () => {
  const { isDark } = useTheme();
  return (
    <View style={styles.dashSkeleton}>
      <View style={styles.dashStatsRow}>
        {Array.from({ length: 3 }).map((_, i) => (
          <View key={i} style={[styles.dashStatCard, { backgroundColor: isDark ? '#1E293B' : colors.neutral[0] }]}>
            <SkeletonBox width={24} height={24} radius={borderRadius.full} />
            <SkeletonBox width={40} height={20} />
            <SkeletonBox width={50} height={11} />
          </View>
        ))}
      </View>
      <SkeletonBox width={140} height={17} style={{ marginBottom: spacing.md }} />
      <LectureCardSkeleton /><LectureCardSkeleton />
    </View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const shadowBase = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.05,
  shadowRadius: 4,
  elevation: 2,
};

const styles = StyleSheet.create({
  // Card
  cardSkeleton: { ...shadowBase, backgroundColor: colors.neutral[0], borderRadius: borderRadius.lg, padding: spacing.md, marginBottom: spacing.md },
  cardHeader: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.sm },
  listSkeleton: { padding: spacing.md },

  // Stats
  statsGrid: { flexDirection: 'row', gap: spacing.sm, padding: spacing.md, justifyContent: 'space-between' },
  statsCard: { ...shadowBase, flexDirection: 'column', alignItems: 'center', backgroundColor: colors.neutral[0], borderRadius: borderRadius.lg, padding: spacing.md, flex: 1 },
  iconCircle: { borderRadius: borderRadius.full, marginBottom: spacing.sm },
  statsContent: { alignItems: 'center', width: '100%' },

  // Lecture
  lectureCard: { ...shadowBase, flexDirection: 'row', backgroundColor: colors.neutral[0], borderRadius: borderRadius.lg, padding: spacing.md, marginBottom: spacing.md },
  lectureTime: { width: 80, paddingRight: spacing.md },
  lectureDivider: { width: 1, backgroundColor: colors.neutral[200], marginHorizontal: spacing.sm },
  lectureInfo: { flex: 1 },

  // Schedule
  scheduleSkeleton: { padding: spacing.md },
  dayGroup: { marginBottom: spacing.xl },

  // Material
  materialCard: { ...shadowBase, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.neutral[0], borderRadius: borderRadius.lg, padding: spacing.md, marginBottom: spacing.md },
  materialRow: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  fileIcon: { borderRadius: borderRadius.md, marginRight: spacing.md },
  materialInfo: { flex: 1 },
  materialActions: { flexDirection: 'row', gap: spacing.sm },
  actionBtn: { borderRadius: borderRadius.sm },

  // Profile
  profileSkeleton: { padding: spacing.lg },
  profileHeader: { alignItems: 'center', marginBottom: spacing.xl },
  avatar: { borderRadius: borderRadius.full },
  profileInfo: { marginTop: spacing.lg },

  // Grade
  gradeRow: { ...shadowBase, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.neutral[0], borderRadius: borderRadius.lg, padding: spacing.md, marginBottom: spacing.md },
  gradeLeft: { flex: 1 },
  gradeBadge: { borderRadius: borderRadius.md },
  gradesListSkeleton: { padding: spacing.md },

  // Student
  studentRow: { ...shadowBase, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.neutral[0], borderRadius: borderRadius.lg, padding: spacing.md, marginBottom: spacing.md },
  studentAvatar: { borderRadius: borderRadius.full, marginRight: spacing.md },
  studentInfo: { flex: 1 },
  studentListSkeleton: { padding: spacing.md },

  // Session
  sessionCard: { ...shadowBase, backgroundColor: colors.neutral[0], borderRadius: borderRadius.lg, padding: spacing.md, marginBottom: spacing.md },
  sessionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  sessionSkeleton: { padding: spacing.md },

  // Objection
  objectionCard: { ...shadowBase, backgroundColor: colors.neutral[0], borderRadius: borderRadius.lg, padding: spacing.md, marginBottom: spacing.md },
  objectionSkeleton: { padding: spacing.md },

  // Dashboard
  dashStatsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  dashStatCard: { ...shadowBase, flex: 1, alignItems: 'center', backgroundColor: colors.neutral[0], borderRadius: borderRadius.lg, padding: spacing.md, gap: spacing.xs },
  dashSkeleton: { padding: spacing.md },
});
