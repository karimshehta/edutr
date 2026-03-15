import React, { useState, useMemo} from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { supabase } from '../../lib/supabase';
import { Button, Input } from '../../components';
import { colors, spacing, typography } from '../../theme';
import { useTheme } from '../../contexts/ThemeContext';

export function JoinCourseScreen({ navigation }: any) {

  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors, isDark), [colors, isDark]);
  const { profile } = useAuth();
  const { showToast } = useToast();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleJoin = async () => {
    const trimmed = code.trim().toUpperCase();
    if (trimmed.length !== 4) {
      setError('Course code must be 4 characters (2 letters + 2 digits).');
      return;
    }

    if (loading) return; // Prevent multiple clicks

    setError('');
    setLoading(true);

    try {
      const { data: course } = await supabase
        .from('courses')
        .select('id, name')
        .eq('code', trimmed)
        .eq('is_active', true)
        .maybeSingle();

      if (!course) {
        setLoading(false);
        setError('No active course found with this code.');
        return;
      }

      // Check blocked_students table
      const { data: blockedRecord, error: blockedCheckError } = await supabase
        .from('blocked_students')
        .select('id')
        .eq('student_id', profile!.id)
        .eq('course_id', course.id)
        .maybeSingle();

      if (blockedCheckError) {
        console.error('Error checking blocked_students:', blockedCheckError);
      }

      console.log('Blocked students check:', { blockedRecord, courseId: course.id, studentId: profile!.id });

      if (blockedRecord) {
        setLoading(false);
        showToast('You have been blocked from this course. Please contact your instructor.', 'error');
        return;
      }

      // Check existing enrollment
      const { data: existing } = await supabase
        .from('enrollments')
        .select('id, is_blocked')
        .eq('student_id', profile!.id)
        .eq('course_id', course.id)
        .maybeSingle();

      if (existing) {
        setLoading(false);
        if (existing.is_blocked) {
          setError('You are blocked from this course.');
        } else {
          setError('You are already enrolled in this course.');
        }
        return;
      }

      // Create new enrollment
      const { error: insertError } = await supabase
        .from('enrollments')
        .insert({ student_id: profile!.id, course_id: course.id });

      setLoading(false);
      
      if (insertError) {
        showToast('Failed to join course', 'error');
        return;
      }

      // Success - show toast and navigate back
      showToast(`Joined "${course.name}" successfully`);
      
      setTimeout(() => {
        navigation.goBack(); // Return to previous screen (Dashboard or Courses)
      }, 500);
      
    } catch (error: any) {
      setLoading(false);
      showToast(error.message || 'Failed to join course', 'error');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.iconWrap}>
          <Ionicons name="enter-outline" size={40} color={colors.primary[500]} />
        </View>
        <Text style={styles.title}>Join a Course</Text>
        <Text style={styles.subtitle}>
          Enter the 4-character course code provided by your professor.
        </Text>

        <Input
          label="Course Code"
          placeholder="e.g. AB12"
          value={code}
          onChangeText={(t) => setCode(t.toUpperCase().slice(0, 4))}
          autoCapitalize="characters"
          maxLength={4}
          error={error}
          icon="key-outline"
        />

        <Button 
          title={loading ? "Joining..." : "Join Course"} 
          onPress={handleJoin} 
          loading={loading}
          disabled={loading}
        />
      </View>
    </View>
  );
}

const makeStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral[50],
    padding: spacing.lg,
    justifyContent: 'center',
  },
  card: {
    backgroundColor: colors.neutral[0],
    borderRadius: 20,
    padding: spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  title: {
    ...typography.h2,
    color: colors.neutral[900],
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.body,
    color: colors.neutral[400],
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
});
