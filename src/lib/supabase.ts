import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ozjiarkntlifsltsqklu.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im96amlhcmtudGxpZnNsdHNxa2x1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc5ODUxMTEsImV4cCI6MjA4MzU2MTExMX0.bn_i68w8BIqmKKH4pOrnj-bGxkdKmK9Am0IIechKFT4';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Helper function to get avatar public URL (matches web platform exactly)
export const getAvatarUrl = (avatarPath: string | null | undefined): string => {
  if (!avatarPath) return '';
  if (avatarPath.startsWith('http')) return avatarPath;
  const { data } = supabase.storage.from('avatars').getPublicUrl(avatarPath);
  return data.publicUrl;
};

export { SUPABASE_URL };
