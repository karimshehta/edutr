import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { supabase } from './supabase';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function registerExpoPushToken(userId: string): Promise<void> {
  if (!Device.isDevice) return;

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') return;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#3B82F6',
      });
    }

    const tokenData = await Notifications.getExpoPushTokenAsync();
    const token = tokenData.data;
    if (!token) return;

    const { data: existing } = await supabase
      .from('push_subscriptions')
      .select('id')
      .eq('user_id', userId)
      .eq('expo_push_token', token)
      .maybeSingle();

    if (!existing) {
      await supabase.from('push_subscriptions').insert({
        user_id: userId,
        token_type: 'expo',
        expo_push_token: token,
        device_name: `${Device.brand ?? 'Mobile'} ${Device.modelName ?? 'App'}`,
      });
    }
  } catch {
    // Push notification registration is non-critical — fail silently
  }
}

export async function unregisterExpoPushToken(userId: string): Promise<void> {
  try {
    const tokenData = await Notifications.getExpoPushTokenAsync().catch(() => null);
    if (!tokenData?.data) return;
    await supabase
      .from('push_subscriptions')
      .delete()
      .eq('user_id', userId)
      .eq('expo_push_token', tokenData.data);
  } catch {
    // Non-critical
  }
}
