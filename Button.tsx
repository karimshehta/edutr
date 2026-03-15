import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { colors, typography, borderRadius } from '../theme';
import { getInitials } from '../lib/helpers';
import { getAvatarUrl } from '../lib/supabase';
import { useTheme } from '../contexts/ThemeContext';

interface AvatarProps {
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
  size?: number;
}

export function Avatar({ firstName, lastName, avatarUrl, size = 44 }: AvatarProps) {
  const { isDark } = useTheme();
  const fullAvatarUrl = getAvatarUrl(avatarUrl);

  if (fullAvatarUrl) {
    return (
      <Image
        source={{ uri: fullAvatarUrl }}
        style={[
          styles.image,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: 2,
            borderColor: isDark ? 'rgba(8,145,178,0.3)' : colors.primary[100],
          },
        ]}
      />
    );
  }

  return (
    <View
      style={[
        styles.placeholder,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: isDark ? 'rgba(8,145,178,0.2)' : colors.primary[100],
          borderWidth: 2,
          borderColor: isDark ? 'rgba(8,145,178,0.4)' : colors.primary[200],
        },
      ]}
    >
      <Text
        style={[
          styles.initials,
          {
            fontSize: size * 0.36,
            color: isDark ? colors.primary[300] : colors.primary[700],
          },
        ]}
      >
        {getInitials(firstName, lastName)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  image: {
    backgroundColor: colors.neutral[200],
  },
  placeholder: {
    backgroundColor: colors.primary[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    ...typography.bodyMedium,
    color: colors.primary[700],
    fontWeight: '700',
  },
});
