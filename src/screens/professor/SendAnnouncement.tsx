import React, { useState, useMemo} from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useToast } from '../../contexts/ToastContext';
import { supabase } from '../../lib/supabase';
import { Button, Input } from '../../components';
import { colors, spacing, typography } from '../../theme';
import { useTheme } from '../../contexts/ThemeContext';

export function SendAnnouncement({ route, navigation }: any) {

  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors, isDark), [colors, isDark]);
  const { courseId, courseName } = route.params;
  const { showToast } = useToast();
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [errors, setErrors] = useState<{ title?: string; message?: string }>({});

  const handleSend = async () => {
    if (sending) return; // Prevent multiple clicks

    // Validation
    const newErrors: { title?: string; message?: string } = {};
    if (!title.trim()) newErrors.title = 'Title is required';
    if (!message.trim()) newErrors.message = 'Message is required';
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    
    setErrors({});
    setSending(true);

    try {
      const { data: enrollments } = await supabase
        .from('enrollments')
        .select('student_id')
        .eq('course_id', courseId);

      if (!enrollments || enrollments.length === 0) {
        setSending(false);
        showToast('No students enrolled in this course', 'error');
        return;
      }

      const notifications = enrollments.map((e) => ({
        user_id: e.student_id,
        title: title.trim(),
        message: message.trim(),
        type: 'course_announcement',
        link: `/course/${courseId}`,
      }));

      const { error } = await supabase.from('notifications').insert(notifications);

      setSending(false);
      
      if (error) {
        showToast('Failed to send announcement', 'error');
        return;
      }

      // Success - show toast and auto-navigate
      showToast(`Announcement sent to ${enrollments.length} student${enrollments.length !== 1 ? 's' : ''}`);
      
      setTimeout(() => {
        navigation.goBack();
      }, 500);
      
    } catch (error: any) {
      setSending(false);
      showToast(error.message || 'Failed to send announcement', 'error');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.iconWrap}>
          <Ionicons name="megaphone-outline" size={40} color={colors.primary[500]} />
        </View>
        <Text style={styles.title}>Send Announcement</Text>
        <Text style={styles.subtitle}>
          Notify all students enrolled in {courseName}.
        </Text>

        <Input 
          label="Title" 
          placeholder="Announcement title" 
          value={title} 
          onChangeText={setTitle}
          error={errors.title}
          icon="create-outline"
        />
        <Input
          label="Message"
          placeholder="Type your announcement..."
          value={message}
          onChangeText={setMessage}
          multiline
          numberOfLines={4}
          style={{ minHeight: 100, textAlignVertical: 'top' }}
          error={errors.message}
          icon="document-text-outline"
        />

        <Button 
          title={sending ? "Sending..." : "Send Announcement"} 
          onPress={handleSend} 
          loading={sending}
          disabled={sending}
        />
      </View>
    </View>
  );
}

const makeStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.neutral[50], padding: spacing.lg },
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
  title: { ...typography.h2, color: colors.neutral[900], textAlign: 'center', marginBottom: spacing.xs },
  subtitle: { ...typography.body, color: colors.neutral[400], textAlign: 'center', marginBottom: spacing.lg },
});
