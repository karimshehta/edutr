import React, { useEffect, useState, useCallback, useMemo} from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { supabase } from '../../lib/supabase';
import { Card, EmptyState } from '../../components';
import { colors, spacing, typography, borderRadius } from '../../theme';
import { Notification } from '../../types';
import { timeAgo } from '../../lib/helpers';
import { useTheme } from '../../contexts/ThemeContext';

interface NotificationWithCourse extends Notification {
  course_name?: string;
  course_code?: string;
}

const TYPE_ICONS: Record<string, { name: keyof typeof Ionicons.glyphMap; color: string }> = {
  info: { name: 'information-circle-outline', color: colors.info[500] },
  success: { name: 'checkmark-circle-outline', color: colors.success[500] },
  warning: { name: 'warning-outline', color: colors.warning[500] },
  grade: { name: 'school-outline', color: colors.primary[500] },
  schedule: { name: 'calendar-outline', color: colors.secondary[500] },
  course_announcement: { name: 'megaphone-outline', color: colors.accent[500] },
};

export function NotificationsScreen({ navigation }: any) {

  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors, isDark), [colors, isDark]);
  const { profile } = useAuth();
  const { showToast } = useToast();
  const [notifications, setNotifications] = useState<NotificationWithCourse[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadNotifications = useCallback(async () => {
    if (!profile) return;

    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (!data) return;

    // Collect unique course IDs from notifications that link to a course
    const courseIds = [...new Set(
      data
        .filter((n) => n.link?.includes('/course/'))
        .map((n) => n.link!.split('/course/')[1])
        .filter(Boolean)
    )];

    // Batch-fetch all needed course names in a single query (no N+1)
    let courseMap: Record<string, { name: string; code: string }> = {};
    if (courseIds.length > 0) {
      const { data: courses } = await supabase
        .from('courses')
        .select('id, name, code')
        .in('id', courseIds);
      (courses || []).forEach((c) => {
        courseMap[c.id] = { name: c.name, code: c.code };
      });
    }

    const enriched: NotificationWithCourse[] = data.map((n) => {
      if (n.link?.includes('/course/')) {
        const courseId = n.link.split('/course/')[1];
        const course = courseMap[courseId];
        if (course) return { ...n, course_name: course.name, course_code: course.code };
      }
      return n;
    });

    setNotifications(enriched);

    // Mark all unread as read
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', profile.id)
      .eq('is_read', false);
  }, [profile]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadNotifications();
    setRefreshing(false);
  };

  const handleViewDetails = (item: NotificationWithCourse) => {
    if (item.type === 'grade') {
      if (profile?.role === 'student') {
        navigation.navigate('Grades');
      } else if (profile?.role === 'professor') {
        navigation.navigate('Courses');
      }
      return;
    }

    // Course-linked notifications
    if (!item.link?.includes('/course/')) return;

    // If course was deleted (not resolved during load), show a friendly message
    if (!item.course_name) {
      showToast('This course is no longer available', 'info');
      return;
    }

    const courseId = item.link.split('/course/')[1];
    const courseName = item.course_name;

    if (profile?.role === 'professor') {
      navigation.navigate('Courses', {
        screen: 'ProfCourseDetail',
        params: { courseId, courseName },
      });
    } else {
      navigation.navigate('Courses', {
        screen: 'CourseDetail',
        params: { courseId, courseName },
      });
    }
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <EmptyState icon="notifications-off-outline" title="No Notifications" message="You're all caught up." />
        }
        renderItem={({ item }) => {
          const icon = TYPE_ICONS[item.type] || TYPE_ICONS.info;
          const hasCourseLink = !!item.link?.includes('/course/') || item.type === 'grade';

          return (
            <Card
              style={[styles.notifCard, !item.is_read ? styles.unread : undefined]}
              onPress={hasCourseLink ? () => handleViewDetails(item) : undefined}
            >
              <View style={styles.notifRow}>
                {/* Type icon */}
                <View style={[styles.iconWrap, { backgroundColor: icon.color + '18' }]}>
                  <Ionicons name={icon.name} size={20} color={icon.color} />
                </View>

                {/* Content */}
                <View style={styles.notifContent}>
                  {/* Course badge — shown when course name is resolved */}
                  {item.course_name ? (
                    <View style={styles.courseBadge}>
                      <Ionicons name="book-outline" size={11} color={colors.primary[600]} />
                      <Text style={styles.courseBadgeText} numberOfLines={1}>
                        {item.course_code ? `${item.course_code} · ` : ''}{item.course_name}
                      </Text>
                    </View>
                  ) : null}

                  <Text style={styles.notifTitle}>{item.title}</Text>
                  <Text style={styles.notifMessage} numberOfLines={3}>{item.message}</Text>

                  <View style={styles.notifFooter}>
                    <Text style={styles.notifTime}>{timeAgo(item.created_at)}</Text>
                    {!item.is_read && <View style={styles.unreadDot} />}
                  </View>
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

  notifCard: { marginBottom: spacing.sm, overflow: 'hidden' },
  unread: { borderLeftWidth: 3, borderLeftColor: colors.primary[400] },

  notifRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: spacing.sm,
  },

  iconWrap: {
    width: 42, height: 42, borderRadius: borderRadius.md,
    alignItems: 'center', justifyContent: 'center',
    marginRight: spacing.sm, flexShrink: 0,
  },

  notifContent: { flex: 1 },

  // Course context badge above the title
  courseBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    backgroundColor: colors.primary[50],
    borderRadius: borderRadius.sm,
    paddingHorizontal: 7,
    paddingVertical: 3,
    marginBottom: 5,
    maxWidth: '100%',
  },
  courseBadgeText: {
    ...typography.tiny,
    color: colors.primary[700],
    fontWeight: '600',
    flexShrink: 1,
  },

  notifTitle: {
    ...typography.captionMedium,
    color: colors.neutral[800],
    fontWeight: '600',
    marginBottom: 2,
  },
  notifMessage: {
    ...typography.caption,
    color: colors.neutral[500],
    lineHeight: 18,
    marginBottom: 6,
  },

  notifFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  notifTime: {
    ...typography.tiny,
    color: colors.neutral[400],
  },
  unreadDot: {
    width: 7, height: 7, borderRadius: 4,
    backgroundColor: colors.primary[500],
  },
});
