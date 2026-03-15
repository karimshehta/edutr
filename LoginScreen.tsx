import React, { useState, useEffect, useMemo} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Image,
  Dimensions,
  Linking,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { colors, spacing, typography } from '../../theme';
import { useToast } from '../../contexts/ToastContext';
import { useTheme } from '../../contexts/ThemeContext';

const { width, height } = Dimensions.get('window');

interface MaterialViewerProps {
  route: {
    params: {
      fileUrl: string;
      fileName: string;
      fileType: string;
    };
  };
  navigation: any;
}

export function MaterialViewer({ route, navigation }: MaterialViewerProps) {

  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors, isDark), [colors, isDark]);
  const { fileUrl, fileName, fileType } = route.params;
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);

  useEffect(() => {
    // For PDFs, open in browser immediately (most reliable approach)
    if (fileType === 'pdf') {
      const timer = setTimeout(() => {
        openInBrowser();
        setLoading(false);
      }, 500);
      return () => clearTimeout(timer);
    }

    // For images, wait for load
    if (fileType === 'image') {
      // Add timeout in case image fails to load
      const timeout = setTimeout(() => {
        if (!imageLoaded) {
          setError('Image took too long to load');
          setLoading(false);
        }
      }, 10000); // 10 second timeout

      return () => clearTimeout(timeout);
    }

    // For other files, show download screen
    setLoading(false);
  }, [fileType]);

  const openInBrowser = async () => {
    try {
      const supported = await Linking.canOpenURL(fileUrl);
      if (supported) {
        await Linking.openURL(fileUrl);
      } else {
        showToast('Cannot open this URL', 'error');
      }
    } catch (error) {
      console.error('Error opening URL:', error);
      showToast('Failed to open file', 'error');
    }
  };

  const handleDownload = async () => {
    try {
      showToast('Downloading file...', 'info');
      
      const fileUri = FileSystem.documentDirectory + fileName;
      const downloadResult = await FileSystem.downloadAsync(fileUrl, fileUri);
      
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(downloadResult.uri, {
          mimeType: fileType === 'pdf' ? 'application/pdf' : 'application/octet-stream',
          dialogTitle: 'Save File',
        });
        showToast('File ready to save', 'success');
      } else {
        showToast(`Downloaded to: ${downloadResult.uri}`, 'success');
      }
    } catch (error: any) {
      console.error('Download error:', error);
      showToast('Failed to download file', 'error');
    }
  };

  const handleShare = async () => {
    try {
      // For images, share directly if loaded
      if (fileType === 'image' && imageLoaded) {
        const fileUri = FileSystem.cacheDirectory + fileName;
        const downloadResult = await FileSystem.downloadAsync(fileUrl, fileUri);
        await Sharing.shareAsync(downloadResult.uri);
        return;
      }

      // For PDFs and other files, download then share
      const fileUri = FileSystem.cacheDirectory + fileName;
      const downloadResult = await FileSystem.downloadAsync(fileUrl, fileUri);
      await Sharing.shareAsync(downloadResult.uri, {
        mimeType: fileType === 'pdf' ? 'application/pdf' : 'application/octet-stream',
      });
    } catch (error: any) {
      console.error('Share error:', error);
      showToast('Failed to share file', 'error');
    }
  };

  const renderContent = () => {
    // Loading state
    if (loading) {
      return (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary[600]} />
          <Text style={[typography.body, styles.statusText]}>
            {fileType === 'pdf' ? 'Opening PDF...' : 'Loading...'}
          </Text>
        </View>
      );
    }

    // Error state
    if (error) {
      return (
        <View style={styles.centerContainer}>
          <Ionicons name="alert-circle" size={64} color={colors.error[500]} />
          <Text style={[typography.h3, styles.errorTitle]}>{error}</Text>
          <Text style={[typography.body, styles.errorSubtext]}>
            Try opening in your browser instead
          </Text>
          <TouchableOpacity style={styles.primaryButton} onPress={openInBrowser}>
            <Ionicons name="open-outline" size={20} color="#fff" />
            <Text style={styles.primaryButtonText}>Open in Browser</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryButton} onPress={handleDownload}>
            <Ionicons name="download-outline" size={20} color={colors.primary[600]} />
            <Text style={styles.secondaryButtonText}>Download File</Text>
          </TouchableOpacity>
        </View>
      );
    }

    // PDF - redirect to browser
    if (fileType === 'pdf') {
      return (
        <View style={styles.centerContainer}>
          <Ionicons name="document-text" size={64} color={colors.primary[600]} />
          <Text style={[typography.h3, styles.statusTitle]}>PDF Viewer</Text>
          <Text style={[typography.body, styles.statusText]}>
            For best experience, PDFs open in your browser
          </Text>
          <TouchableOpacity style={styles.primaryButton} onPress={openInBrowser}>
            <Ionicons name="open-outline" size={20} color="#fff" />
            <Text style={styles.primaryButtonText}>Open in Browser</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryButton} onPress={handleDownload}>
            <Ionicons name="download-outline" size={20} color={colors.primary[600]} />
            <Text style={styles.secondaryButtonText}>Download Instead</Text>
          </TouchableOpacity>
        </View>
      );
    }

    // Image viewer
    if (fileType === 'image') {
      return (
        <View style={styles.imageContainer}>
          {!imageLoaded && (
            <View style={styles.imageLoadingOverlay}>
              <ActivityIndicator size="large" color={colors.primary[600]} />
            </View>
          )}
          <Image
            source={{ uri: fileUrl }}
            style={styles.image}
            resizeMode="contain"
            onLoad={() => {
              setImageLoaded(true);
              setLoading(false);
            }}
            onError={(e) => {
              console.error('Image load error:', e.nativeEvent.error);
              setError('Failed to load image');
              setLoading(false);
            }}
          />
        </View>
      );
    }

    // Other file types
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="document" size={64} color={colors.primary[600]} />
        <Text style={[typography.h3, styles.statusTitle]}>
          Preview not available
        </Text>
        <Text style={[typography.body, styles.statusText]}>
          This file type cannot be previewed in the app
        </Text>
        <TouchableOpacity style={styles.primaryButton} onPress={handleDownload}>
          <Ionicons name="download" size={20} color="#fff" />
          <Text style={styles.primaryButtonText}>Download File</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryButton} onPress={openInBrowser}>
          <Ionicons name="open-outline" size={20} color={colors.primary[600]} />
          <Text style={styles.secondaryButtonText}>Open in Browser</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color={colors.neutral[900]} />
          </TouchableOpacity>

          <View style={styles.headerTitle}>
            <Text style={typography.bodyMedium} numberOfLines={1}>
              {fileName}
            </Text>
          </View>

          <View style={styles.headerActions}>
            {!loading && !error && (
              <>
                <TouchableOpacity style={styles.iconButton} onPress={openInBrowser}>
                  <Ionicons name="open-outline" size={22} color={colors.primary[600]} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.iconButton} onPress={handleShare}>
                  <Ionicons name="share-outline" size={22} color={colors.primary[600]} />
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>

        {/* Content */}
        {renderContent()}
      </View>
    </SafeAreaView>
  );
}

const makeStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.neutral[0],
  },
  container: {
    flex: 1,
    backgroundColor: colors.neutral[50],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.neutral[0],
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[200],
  },
  backButton: {
    padding: spacing.xs,
    marginRight: spacing.sm,
  },
  headerTitle: {
    flex: 1,
  },
  headerActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  iconButton: {
    padding: spacing.xs,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  imageContainer: {
    flex: 1,
    backgroundColor: colors.neutral[900],
    position: 'relative',
  },
  image: {
    width: width,
    height: height - 100,
  },
  imageLoadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.neutral[900],
    zIndex: 10,
  },
  statusTitle: {
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    textAlign: 'center',
    color: colors.neutral[900],
  },
  statusText: {
    marginTop: spacing.md,
    marginBottom: spacing.xl,
    textAlign: 'center',
    color: colors.neutral[600],
  },
  errorTitle: {
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    textAlign: 'center',
    color: colors.error[600],
  },
  errorSubtext: {
    marginBottom: spacing.xl,
    textAlign: 'center',
    color: colors.neutral[600],
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary[600],
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: 12,
    marginBottom: spacing.md,
    minWidth: 200,
    justifyContent: 'center',
  },
  primaryButtonText: {
    ...typography.bodyMedium,
    color: colors.neutral[0],
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.neutral[0],
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.primary[600],
    minWidth: 200,
    justifyContent: 'center',
  },
  secondaryButtonText: {
    ...typography.bodyMedium,
    color: colors.primary[600],
  },
});
