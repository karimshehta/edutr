import React, { useState, useEffect, useMemo} from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Modal, Share,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { supabase } from '../../lib/supabase';
import { Button, Input, Avatar, Card } from '../../components';
import { colors, spacing, typography, borderRadius } from '../../theme';
import { useTheme } from '../../contexts/ThemeContext';

export function ProfileScreen({ navigation }: any) {

  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors, isDark), [colors, isDark]);
  const { profile, signOut, refreshProfile } = useAuth();
  const { showToast } = useToast();
  const [editing, setEditing] = useState(false);
  const [firstName, setFirstName] = useState(profile?.first_name || '');
  const [lastName, setLastName] = useState(profile?.last_name || '');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);

  // Sync local state when profile updates
  useEffect(() => {
    if (profile && !editing) {
      setFirstName(profile.first_name || '');
      setLastName(profile.last_name || '');
      setPhone(profile.phone || '');
    }
  }, [profile, editing]);

  const handleAvatarUpload = async () => {
    if (uploadingAvatar) return; // Prevent multiple clicks

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'image/*',
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      const asset = result.assets[0];

      if (!asset.mimeType?.startsWith('image/')) {
        showToast('Please select an image file', 'error');
        return;
      }

      if (asset.size && asset.size > 2 * 1024 * 1024) {
        showToast('Image size must be less than 2MB', 'error');
        return;
      }

      setUploadingAvatar(true);

      // Delete old avatar if exists
      if (profile?.avatar_url && !profile.avatar_url.startsWith('http')) {
        await supabase.storage.from('avatars').remove([profile.avatar_url]);
      }

      const fileExt = asset.name.split('.').pop();
      const fileName = `${profile?.id}/${Date.now()}.${fileExt}`;

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const projectUrl = supabase.storage.from('avatars').getPublicUrl('').data.publicUrl.split('/storage/v1/object/public')[0];
      const uploadUrl = `${projectUrl}/storage/v1/object/avatars/${fileName}`;

      const formData = new FormData();
      formData.append('file', {
        uri: asset.uri,
        type: asset.mimeType || 'image/jpeg',
        name: asset.name,
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

      const { error: dbError } = await supabase
        .from('user_profiles')
        .update({ 
          avatar_url: fileName,
          updated_at: new Date().toISOString(),
        })
        .eq('id', profile?.id);

      if (dbError) throw dbError;

      await refreshProfile();
      showToast('Avatar uploaded successfully');
    } catch (error: any) {
      console.error('Avatar upload error:', error);
      showToast(error.message || 'Could not upload avatar', 'error');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSave = async () => {
    if (!profile) return;
    if (saving) return; // Prevent multiple clicks
    
    setSaving(true);
    
    try {
      const { error: dbError } = await supabase
        .from('user_profiles')
        .update({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          phone: phone.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', profile.id);

      if (dbError) throw dbError;

      await refreshProfile();
      
      setEditing(false);
      showToast('Profile updated successfully');
    } catch (error: any) {
      showToast(error.message || 'Failed to update profile', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = () => {
    setShowSignOutConfirm(true);
  };

  const confirmSignOut = async () => {
    setShowSignOutConfirm(false);
    await signOut();
    showToast('Signed out successfully');
  };

  const cancelSignOut = () => {
    setShowSignOutConfirm(false);
  };

  const handleRecommendApp = async () => {
    const isStudent = profile?.role === 'student';
    const message = isStudent
      ? `I use OMREX to track my grades, attendance, and course materials. Check it out!\nhttps://omrex.app`
      : `Manage your courses, attendance, and exams with OMREX — the smart education platform for professors.\nhttps://omrex.app`;
    try {
      await Share.share({
        message,
        url: 'https://omrex.app',
        title: 'OMREX – Smart Education Platform',
      });
    } catch {
      // User cancelled
    }
  };

  if (!profile) return null;

  const isProfessor = profile.role === 'professor';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View style={styles.avatarContainer}>
          <Avatar
            firstName={profile.first_name}
            lastName={profile.last_name}
            avatarUrl={profile.avatar_url}
            size={80}
          />
          <TouchableOpacity
            style={styles.cameraButton}
            onPress={handleAvatarUpload}
            disabled={uploadingAvatar}
          >
            {uploadingAvatar ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="camera" size={16} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
        <Text style={styles.name}>{profile.first_name} {profile.last_name}</Text>
        <Text style={styles.email}>{profile.email}</Text>
        <View style={styles.roleTag}>
          <Text style={styles.roleText}>{profile.role}</Text>
        </View>
      </View>

      {editing ? (
        <Card style={styles.editCard}>
          <Input label="First Name" value={firstName} onChangeText={setFirstName} />
          <Input label="Last Name" value={lastName} onChangeText={setLastName} />
          <Input label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
          <View style={styles.editActions}>
            <Button title="Cancel" variant="outline" onPress={() => setEditing(false)} style={styles.editBtn} size="sm" />
            <Button title="Save Changes" onPress={handleSave} loading={saving} style={styles.editBtn} size="sm" />
          </View>
        </Card>
      ) : (
        <Card style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Ionicons name="person-outline" size={18} color={colors.neutral[400]} />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Name</Text>
              <Text style={styles.infoValue}>{profile.first_name || '-'} {profile.last_name || ''}</Text>
            </View>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="mail-outline" size={18} color={colors.neutral[400]} />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Email</Text>
              <Text style={styles.infoValue}>{profile.email}</Text>
            </View>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="call-outline" size={18} color={colors.neutral[400]} />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Phone</Text>
              <Text style={styles.infoValue}>{profile.phone || 'Not set'}</Text>
            </View>
          </View>
          <Button
            title="Edit Profile"
            variant="outline"
            onPress={() => {
              setFirstName(profile.first_name || '');
              setLastName(profile.last_name || '');
              setPhone(profile.phone || '');
              setEditing(true);
            }}
            style={{ marginTop: spacing.md }}
          />
        </Card>
      )}

      {/* OMR & Web Features - ONLY for professors */}
      {isProfessor && (
        <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('WebOnlyNotice')}>
          <Ionicons name="desktop-outline" size={20} color={colors.neutral[600]} />
          <Text style={styles.menuText}>OMR & Web Features</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.neutral[300]} />
        </TouchableOpacity>
      )}

      {/* Recommend App */}
      <TouchableOpacity style={styles.menuItem} onPress={handleRecommendApp}>
        <Ionicons name="share-social-outline" size={20} color={colors.primary[600]} />
        <View style={{ flex: 1, marginLeft: spacing.md }}>
          <Text style={styles.menuText}>Recommend OMREX</Text>
          <Text style={[styles.menuSubtext, { color: colors.neutral[400] }]}>Share the app with friends</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.neutral[300]} />
      </TouchableOpacity>

      {/* Sign Out Confirmation Modal */}
      <Modal
        visible={showSignOutConfirm}
        transparent
        animationType="fade"
        onRequestClose={cancelSignOut}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalIconWrap}>
              <Ionicons name="log-out-outline" size={28} color={colors.error[500]} />
            </View>
            <Text style={styles.modalTitle}>Sign Out?</Text>
            <Text style={styles.modalMessage}>Are you sure you want to sign out of your account?</Text>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={cancelSignOut}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSignOutBtn} onPress={confirmSignOut}>
                <Text style={styles.modalSignOutText}>Sign Out</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Button
        title="Sign Out"
        variant="danger"
        onPress={handleSignOut}
        style={{ marginTop: spacing.lg }}
      />

      <Text style={styles.powered}>Powered by OMREX</Text>
      <Text style={styles.version}>EduTracker v1.0.0</Text>
    </ScrollView>
  );
}

const makeStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.neutral[50] },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  header: { alignItems: 'center', marginBottom: spacing.lg },
  avatarContainer: {
    position: 'relative',
  },
  cameraButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary[600],
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: colors.neutral[0],
  },
  name: { ...typography.h2, color: colors.neutral[900], marginTop: spacing.md },
  email: { ...typography.body, color: colors.neutral[400], marginTop: 2 },
  roleTag: { backgroundColor: colors.primary[50], paddingHorizontal: 12, paddingVertical: 4, borderRadius: borderRadius.full, marginTop: spacing.sm },
  roleText: { ...typography.captionMedium, color: colors.primary[600], textTransform: 'capitalize' },
  editCard: { marginBottom: spacing.md },
  editActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md, justifyContent: 'flex-end' },
  editBtn: { minWidth: 110 },
  infoCard: { marginBottom: spacing.md },
  infoRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.neutral[50] },
  infoContent: { flex: 1, marginLeft: spacing.md },
  infoLabel: { ...typography.small, color: colors.neutral[400] },
  infoValue: { ...typography.body, color: colors.neutral[800] },
  menuItem: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.neutral[0], padding: spacing.md,
    borderRadius: borderRadius.lg, marginBottom: spacing.sm,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 2, elevation: 1,
  },
  menuText: { ...typography.body, color: colors.neutral[700] },
  menuSubtext: { ...typography.small, marginTop: 1 },
  powered: { ...typography.small, color: colors.neutral[400], textAlign: 'center', marginTop: spacing.lg },
  version: { ...typography.small, color: colors.neutral[300], textAlign: 'center', marginTop: 4 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  modalCard: {
    backgroundColor: colors.neutral[0],
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 12,
  },
  modalIconWrap: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.full,
    backgroundColor: colors.error[50],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  modalTitle: {
    ...typography.h3,
    color: colors.neutral[900],
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  modalMessage: {
    ...typography.body,
    color: colors.neutral[500],
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.xl,
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    width: '100%',
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: borderRadius.md,
    backgroundColor: colors.neutral[100],
    alignItems: 'center',
  },
  modalCancelText: {
    ...typography.bodyMedium,
    color: colors.neutral[700],
  },
  modalSignOutBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: borderRadius.md,
    backgroundColor: colors.error[500],
    alignItems: 'center',
  },
  modalSignOutText: {
    ...typography.bodyMedium,
    color: '#fff',
  },
});
