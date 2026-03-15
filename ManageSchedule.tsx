import React, { useEffect, useState, useCallback, useMemo} from 'react';
import {
  View, Text, StyleSheet, FlatList, RefreshControl, Linking, TouchableOpacity, Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { supabase } from '../../lib/supabase';
import { Card, Badge, EmptyState, MaterialCardSkeleton } from '../../components';
import { colors, spacing, typography, borderRadius } from '../../theme';
import { CourseMaterial } from '../../types';
import { formatFileSize, formatDate } from '../../lib/helpers';
import { useTheme } from '../../contexts/ThemeContext';

interface FileLimits {
  max_files: number;
  max_file_size_mb: number;
}

export function ProfMaterials({ route }: any) {

  const { colors, isDark } = useTheme();
  const st = useMemo(() => makeStyles(colors, isDark), [colors, isDark]);
  const { courseId } = route.params;
  const { profile } = useAuth();
  const { showToast } = useToast();
  const [materials, setMaterials] = useState<CourseMaterial[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pinningId, setPinningId] = useState<string | null>(null);
  const [limits, setLimits] = useState<FileLimits>({ max_files: 14, max_file_size_mb: 50 });

  const loadMaterials = useCallback(async () => {
    const { data } = await supabase
      .from('course_materials').select('*').eq('course_id', courseId)
      .order('is_pinned', { ascending: false }).order('created_at', { ascending: false });
    setMaterials(data || []);
    setLoading(false);
  }, [courseId]);

  const loadLimits = useCallback(async () => {
    try {
      const { data: courseLimits } = await supabase
        .from('course_file_limits').select('*').eq('course_id', courseId).maybeSingle();
      if (courseLimits) {
        setLimits({ max_files: courseLimits.max_files, max_file_size_mb: courseLimits.max_file_size_mb });
        return;
      }
      const { data: globalLimits } = await supabase
        .from('course_file_limits').select('*').is('course_id', null).maybeSingle();
      if (globalLimits) {
        setLimits({ max_files: globalLimits.max_files, max_file_size_mb: globalLimits.max_file_size_mb });
      }
    } catch (e) {
      // Keep defaults
    }
  }, [courseId]);

  useEffect(() => { loadMaterials(); loadLimits(); }, [loadMaterials, loadLimits]);

  const onRefresh = async () => { setRefreshing(true); await loadMaterials(); setRefreshing(false); };

  const handleUpload = async () => {
    if (!profile) return;
    if (uploading) return; // Prevent multiple clicks

    if (materials.length >= limits.max_files) {
      showToast(`You can only upload up to ${limits.max_files} files`, 'error');
      return;
    }

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*', 'application/vnd.openxmlformats-officedocument.presentationml.presentation', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
        copyToCacheDirectory: true,
      });
      
      if (result.canceled || !result.assets?.[0]) return;

      const file = result.assets[0];

      const maxBytes = limits.max_file_size_mb * 1024 * 1024;
      if ((file.size || 0) > maxBytes) {
        showToast(`Maximum file size is ${limits.max_file_size_mb}MB`, 'error');
        return;
      }

      setUploading(true);
      
      const ext = file.name.split('.').pop() || 'bin';
      const filePath = `${courseId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      let fileType = 'doc';
      if (ext === 'pdf') fileType = 'pdf';
      else if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext.toLowerCase())) fileType = 'image';
      else if (ext === 'pptx') fileType = 'pptx';
      else if (ext === 'docx') fileType = 'docx';

      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('Not authenticated');

        const projectUrl = supabase.storage.from('course-materials').getPublicUrl('').data.publicUrl.split('/storage/v1/object/public')[0];
        const uploadUrl = `${projectUrl}/storage/v1/object/course-materials/${filePath}`;

        const formData = new FormData();
        formData.append('file', {
          uri: file.uri,
          type: file.mimeType || 'application/octet-stream',
          name: file.name,
        } as any);

        const response = await fetch(uploadUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: formData,
        });

        if (!response.ok) {
          throw new Error(`Upload failed with status ${response.status}`);
        }

        const { data: urlData } = supabase.storage.from('course-materials').getPublicUrl(filePath);
        
        const { error: insertError } = await supabase.from('course_materials').insert({
          course_id: courseId,
          title: file.name,
          file_url: urlData.publicUrl,
          file_type: fileType,
          file_size: file.size || 0,
          material_type: 'lecture',
          uploaded_by: profile.id,
          order_index: materials.length,
        });

        if (insertError) {
          showToast('Database error: ' + insertError.message, 'error');
          setUploading(false);
          return;
        }

        setUploading(false);
        await loadMaterials();
        showToast('Material uploaded successfully');
      } catch (readError: any) {
        throw readError;
      }
    } catch (error: any) {
      showToast('Upload failed: ' + (error.message || 'An error occurred'), 'error');
      setUploading(false);
    }
  };

  const togglePin = async (m: CourseMaterial) => {
    if (pinningId) return; // Prevent multiple clicks
    
    setPinningId(m.id);
    const newPinnedState = !m.is_pinned;
    
    const { error } = await supabase
      .from('course_materials')
      .update({ 
        is_pinned: newPinnedState, 
        pinned_at: newPinnedState ? new Date().toISOString() : null 
      })
      .eq('id', m.id);
    
    if (error) {
      showToast('Failed to update pin status', 'error');
    } else {
      showToast(newPinnedState ? 'Material pinned' : 'Material unpinned', 'success');
    }
    
    await loadMaterials();
    setPinningId(null);
  };

  const deleteMaterial = async (m: CourseMaterial) => {
    if (deletingId) return; // Prevent multiple clicks
    
    setDeletingId(m.id);
    
    const { error } = await supabase
      .from('course_materials')
      .delete()
      .eq('id', m.id);
    
    if (error) {
      showToast('Failed to delete material', 'error');
      setDeletingId(null);
    } else {
      showToast('Material deleted');
      await loadMaterials();
      setDeletingId(null);
    }
  };

  const canUpload = materials.length < limits.max_files;

  return (
    <View style={st.container}>
      <FlatList
        data={loading ? [] : materials}
        keyExtractor={(item) => item.id}
        contentContainerStyle={st.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListHeaderComponent={
          loading ? null :
          <>
            <View style={st.limitsCard}>
              <Ionicons name="information-circle-outline" size={18} color={colors.info[600]} />
              <Text style={st.limitsText}>
                {materials.length} of {limits.max_files} files uploaded · Max size: {limits.max_file_size_mb}MB per file
              </Text>
            </View>

            {canUpload && (
              <TouchableOpacity
                style={[st.uploadBtn, uploading && st.uploadBtnDisabled]}
                onPress={handleUpload} 
                disabled={uploading} 
                activeOpacity={0.8}
              >
                {uploading ? (
                  <>
                    <Ionicons name="hourglass" size={20} color="#fff" />
                    <Text style={st.uploadBtnText}>Uploading...</Text>
                  </>
                ) : (
                  <>
                    <Ionicons name="cloud-upload-outline" size={20} color="#fff" />
                    <Text style={st.uploadBtnText}>Upload Material</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </>
        }
        ListEmptyComponent={
          loading ? (
            <View style={{ padding: 16 }}>
              <MaterialCardSkeleton />
              <MaterialCardSkeleton />
              <MaterialCardSkeleton />
            </View>
          ) : (
          <View style={st.emptyContainer}>
            <View style={st.emptyIconWrap}>
              <Ionicons name="folder-open-outline" size={48} color={colors.neutral[300]} />
            </View>
            <Text style={st.emptyTitle}>No materials uploaded yet</Text>
            <Text style={st.emptyMessage}>Upload your first course material to get started</Text>
            {canUpload && (
              <TouchableOpacity
                style={st.emptyUploadBtn}
                onPress={handleUpload}
                disabled={uploading}
              >
                <Ionicons name="cloud-upload-outline" size={18} color={colors.primary[600]} />
                <Text style={st.emptyUploadBtnText}>Upload Material</Text>
              </TouchableOpacity>
            )}
          </View>
          )}
        
        renderItem={({ item }) => (
          <MaterialCard
            material={item}
            onPress={() => Linking.openURL(item.file_url)}
            onPin={() => togglePin(item)}
            onDelete={() => deleteMaterial(item)}
            isPinning={pinningId === item.id}
            isDeleting={deletingId === item.id}
          />
        )}
      />
    </View>
  );
}

// Separate Material Card component with animation
function MaterialCard({ 
  material, 
  onPress, 
  onPin, 
  onDelete, 
  isPinning, 
  isDeleting 
}: { 
  material: CourseMaterial; 
  onPress: () => void; 
  onPin: () => void; 
  onDelete: () => void;
  isPinning: boolean;
  isDeleting: boolean;
}) {
  const scaleAnim = React.useRef(new Animated.Value(1)).current;

  const handlePinPress = () => {
    // Bounce animation
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 1.3,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start();
    
    onPin();
  };

  const getFileIcon = (type: string) => {
    switch (type) {
      case 'pdf':
        return 'document-text';
      case 'image':
        return 'image';
      case 'pptx':
        return 'easel';
      case 'docx':
        return 'document';
      default:
        return 'document-outline';
    }
  };

  return (
    <Card style={[st.materialCard, material.is_pinned && st.materialCardPinned]}>
      <TouchableOpacity style={st.materialRow} onPress={onPress} activeOpacity={0.7}>
        <View style={st.fileIcon}>
          <Ionicons 
            name={getFileIcon(material.file_type)} 
            size={24} 
            color={colors.primary[600]} 
          />
        </View>
        <View style={st.materialInfo}>
          <Text style={st.materialTitle} numberOfLines={2}>{material.title}</Text>
          <Text style={st.materialMeta}>
            {material.file_type.toUpperCase()} · {formatFileSize(material.file_size)} · {formatDate(material.created_at)}
          </Text>
        </View>
      </TouchableOpacity>
      
      <View style={st.actions}>
        <TouchableOpacity 
          style={st.actionBtn} 
          onPress={handlePinPress}
          disabled={isPinning}
        >
          <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
            <Ionicons 
              name={material.is_pinned ? 'push' : 'push-outline'} 
              size={24} 
              color={material.is_pinned ? colors.error[600] : colors.neutral[400]} 
            />
          </Animated.View>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={st.actionBtn} 
          onPress={onDelete}
          disabled={isDeleting}
        >
          {isDeleting ? (
            <Ionicons name="hourglass" size={20} color={colors.error[400]} />
          ) : (
            <Ionicons name="trash-outline" size={20} color={colors.error[400]} />
          )}
        </TouchableOpacity>
      </View>
    </Card>
  );
}

const makeStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.neutral[50] },
  list: { padding: spacing.md, paddingBottom: spacing.xxl },

  limitsCard: {
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: spacing.sm,
    backgroundColor: colors.info[50], 
    borderRadius: borderRadius.md,
    padding: spacing.md, 
    marginBottom: spacing.md,
    borderWidth: 1, 
    borderColor: colors.info[100],
  },
  limitsText: { 
    ...typography.caption, 
    color: colors.info[700], 
    flex: 1,
    lineHeight: 18,
  },

  uploadBtn: {
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center',
    backgroundColor: colors.primary[600], 
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md, 
    marginBottom: spacing.md, 
    gap: spacing.sm,
    shadowColor: colors.primary[600],
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  uploadBtnDisabled: {
    opacity: 0.6,
  },
  uploadBtnText: { 
    ...typography.button, 
    color: '#fff', 
    fontSize: 15,
    fontWeight: '600',
  },

  // Empty state
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl * 2,
    paddingHorizontal: spacing.lg,
  },
  emptyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.neutral[100],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  emptyTitle: {
    ...typography.h3,
    color: colors.neutral[700],
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  emptyMessage: {
    ...typography.body,
    color: colors.neutral[400],
    textAlign: 'center',
    marginBottom: spacing.lg,
    lineHeight: 22,
  },
  emptyUploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    borderColor: colors.primary[600],
    backgroundColor: colors.primary[50],
  },
  emptyUploadBtnText: {
    ...typography.button,
    color: colors.primary[600],
    fontSize: 14,
    fontWeight: '600',
  },

  // Material card
  materialCard: { 
    marginBottom: spacing.sm, 
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.neutral[100],
  },
  materialCardPinned: {
    borderLeftWidth: 3,
    borderLeftColor: colors.error[600],
    backgroundColor: isDark ? 'rgba(239,68,68,0.1)' : '#FFF9F9',
  },
  materialRow: { 
    flexDirection: 'row', 
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  fileIcon: {
    width: 48, 
    height: 48, 
    borderRadius: borderRadius.md, 
    backgroundColor: colors.primary[50],
    alignItems: 'center', 
    justifyContent: 'center', 
    marginRight: spacing.md,
  },
  materialInfo: { 
    flex: 1,
    paddingTop: 2,
  },
  materialTitle: { 
    ...typography.body, 
    color: colors.neutral[900], 
    fontWeight: '600',
    marginBottom: spacing.xs,
    lineHeight: 20,
  },
  materialMeta: { 
    ...typography.small, 
    color: colors.neutral[500], 
    lineHeight: 18,
  },
  actions: { 
    flexDirection: 'row', 
    justifyContent: 'flex-end',
    gap: spacing.md,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.neutral[100],
  },
  actionBtn: { 
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
  },
});
