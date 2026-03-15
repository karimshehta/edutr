import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { supabase } from '../../lib/supabase';
import { Button, Input } from '../../components';
import { colors, spacing, typography, borderRadius } from '../../theme';
import { useTheme } from '../../contexts/ThemeContext';

const SEMESTERS = ['First semester', 'Second semester'];
const CURRENT_YEAR = new Date().getFullYear();

export function CreateCourseScreen({ navigation }: any) {

  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors, isDark), [colors, isDark]);
  const { profile } = useAuth();
  const { showToast } = useToast();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [department, setDepartment] = useState('');
  const [semester, setSemester] = useState(SEMESTERS[0]);
  const [year, setYear] = useState(CURRENT_YEAR.toString());
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isAtLimit, setIsAtLimit] = useState(false);
  const [maxCourses, setMaxCourses] = useState<number | null>(null);

  useEffect(() => {
    const checkLimit = async () => {
      if (!profile) return;
      try {
        const effectivePlan = profile.plan || 'free';
        const [{ data: planData }, { count: courseCount }] = await Promise.all([
          supabase.from('plan_settings').select('max_courses').eq('plan_name', effectivePlan).maybeSingle(),
          supabase.from('courses').select('id', { count: 'exact', head: true }).eq('created_by', profile.id),
        ]);
        const limit = planData?.max_courses ?? null;
        setMaxCourses(limit);
        setIsAtLimit(limit !== null && (courseCount || 0) >= limit);
      } catch {}
    };
    checkLimit();
  }, [profile]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!name.trim()) {
      newErrors.name = 'Course name is required.';
    }
    if (!department.trim()) {
      newErrors.department = 'Department is required.';
    }
    if (!year.trim()) {
      newErrors.year = 'Academic year is required.';
    } else if (isNaN(parseInt(year))) {
      newErrors.year = 'Please enter a valid year.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleCreate = async () => {
    if (!validateForm()) return;
    if (!profile) return;
    if (loading) return; // Prevent multiple clicks

    setLoading(true);

    try {
      const { data: code, error: codeErr } = await supabase.rpc('generate_course_code');
      if (codeErr || !code) {
        console.error('Course code generation error:', codeErr);
        showToast('Failed to generate course code', 'error');
        setLoading(false);
        return;
      }

      const { data: course, error: createErr } = await supabase
        .from('courses')
        .insert({
          code,
          name: name.trim(),
          description: description.trim() || '', // Empty string instead of null
          department: department.trim(),
          semester,
          year: parseInt(year),
          created_by: profile.id,
        })
        .select()
        .single();

      if (createErr || !course) {
        console.error('Course creation error:', createErr);
        showToast(createErr?.message || 'Failed to create course', 'error');
        setLoading(false);
        return;
      }

      const { error: assignError } = await supabase.from('course_assignments').insert({
        course_id: course.id,
        user_id: profile.id,
      });

      setLoading(false);

      if (assignError) {
        console.error('Course assignment error:', assignError);
        showToast('Course created but failed to assign', 'error');
        return;
      }

      // Success - show toast and navigate back to courses list
      showToast(`Course "${course.name}" created successfully`);
      
      // Go back to courses list after short delay to show the new course
      setTimeout(() => {
        navigation.goBack();
      }, 500);
      
    } catch (error: any) {
      console.error('Unexpected error creating course:', error);
      setLoading(false);
      showToast(error.message || 'An unexpected error occurred', 'error');
    }
  };

  if (isAtLimit) {
    return (
      <View style={styles.limitContainer}>
        <View style={styles.limitIconWrap}>
          <Ionicons name="lock-closed" size={40} color={colors.warning[500]} />
        </View>
        <Text style={styles.limitTitle}>Course Limit Reached</Text>
        <Text style={styles.limitMsg}>
          Your current plan allows up to {maxCourses} course{maxCourses !== 1 ? 's' : ''}. Upgrade to Pro to create more courses.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Create New Course</Text>
        <Text style={styles.subtitle}>Fill in the course details below</Text>
      </View>

      <Input
        label="Course Name"
        placeholder="e.g. Introduction to Programming"
        value={name}
        onChangeText={setName}
        error={errors.name}
        icon="book-outline"
      />
      
      <Input
        label="Department"
        placeholder="e.g. Computer Science"
        value={department}
        onChangeText={setDepartment}
        error={errors.department}
        icon="business-outline"
      />

      <Text style={styles.label}>Semester</Text>
      <View style={styles.segmented}>
        {SEMESTERS.map((s) => (
          <TouchableOpacity
            key={s}
            style={[styles.segment, semester === s && styles.segmentActive]}
            onPress={() => setSemester(s)}
            activeOpacity={0.7}
          >
            <Text style={[styles.segmentText, semester === s && styles.segmentTextActive]}>
              {s}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Input
        label="Academic Year"
        placeholder="2025"
        value={year}
        onChangeText={setYear}
        keyboardType="number-pad"
        error={errors.year}
        icon="calendar-outline"
      />

      <Input
        label="Description (Optional)"
        placeholder="Brief course description"
        value={description}
        onChangeText={setDescription}
        multiline
        numberOfLines={3}
        icon="document-text-outline"
      />

      <Button
        title={loading ? "Creating..." : "Create Course"}
        onPress={handleCreate}
        loading={loading}
        disabled={loading}
        style={{ marginTop: spacing.lg }}
      />
    </ScrollView>
  );
}

const makeStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.neutral[50] },
  limitContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, backgroundColor: colors.neutral[50] },
  limitIconWrap: { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.warning[50], alignItems: 'center', justifyContent: 'center', marginBottom: spacing.lg },
  limitTitle: { ...typography.h3, color: colors.neutral[800], marginBottom: spacing.sm, textAlign: 'center' },
  limitMsg: { ...typography.body, color: colors.neutral[500], textAlign: 'center', lineHeight: 22 },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  header: {
    marginBottom: spacing.lg,
  },
  title: {
    ...typography.h2,
    color: colors.neutral[900],
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.body,
    color: colors.neutral[500],
  },
  label: { 
    ...typography.captionMedium, 
    color: colors.neutral[700], 
    marginBottom: spacing.xs,
    marginTop: spacing.xs,
  },
  segmented: {
    flexDirection: 'row',
    backgroundColor: colors.neutral[100],
    borderRadius: borderRadius.md,
    padding: 4,
    marginBottom: spacing.md,
  },
  segment: { 
    flex: 1, 
    paddingVertical: spacing.sm, 
    alignItems: 'center', 
    borderRadius: borderRadius.sm,
  },
  segmentActive: { 
    backgroundColor: colors.neutral[0], 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 1 }, 
    shadowOpacity: 0.08, 
    shadowRadius: 2, 
    elevation: 2,
  },
  segmentText: { 
    ...typography.captionMedium, 
    color: colors.neutral[500],
  },
  segmentTextActive: { 
    color: colors.primary[600],
    fontWeight: '600',
  },
});
