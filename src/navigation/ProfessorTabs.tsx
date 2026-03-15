import React from 'react';
import { View, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ProfessorDashboard } from '../screens/professor/ProfessorDashboard';
import { ProfessorCourses } from '../screens/professor/ProfessorCourses';
import { ProfessorSchedule } from '../screens/professor/ProfessorSchedule';
import { CreateCourseScreen } from '../screens/professor/CreateCourseScreen';
import { ProfCourseDetail } from '../screens/professor/ProfCourseDetail';
import { ProfStudents } from '../screens/professor/ProfStudents';
import { ManageSchedule } from '../screens/professor/ManageSchedule';
import { ProfMaterials } from '../screens/professor/ProfMaterials';
import { ProfAttendance } from '../screens/professor/ProfAttendance';
import { ProfGrades } from '../screens/professor/ProfGrades';
import { ProfObjections } from '../screens/professor/ProfObjections';
import { SendAnnouncement } from '../screens/professor/SendAnnouncement';
import { NotificationsScreen } from '../screens/shared/NotificationsScreen';
import { ProfileScreen } from '../screens/shared/ProfileScreen';
import { WebOnlyNotice } from '../screens/shared/WebOnlyNotice';
import { colors, typography } from '../theme';
import { useTheme } from '../contexts/ThemeContext';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const buildScreenOptions = (isDark: boolean) => ({
  headerStyle: {
    backgroundColor: isDark ? '#1E293B' : colors.neutral[0],
  },
  headerTitleStyle: {
    ...typography.h3,
    color: isDark ? '#F1F5F9' : colors.neutral[900],
  },
  headerShadowVisible: false,
  headerTintColor: colors.primary[isDark ? 300 : 500],
  contentStyle: {
    backgroundColor: isDark ? '#0F172A' : colors.neutral[50],
  },
});

function DashboardStack() {
  const { isDark } = useTheme();
  const so = buildScreenOptions(isDark);
  return (
    <Stack.Navigator screenOptions={so}>
      <Stack.Screen name="ProfHome" component={ProfessorDashboard} options={{ title: 'Dashboard' }} />
      <Stack.Screen name="CreateCourse" component={CreateCourseScreen} options={{ title: 'Create Course' }} />
      <Stack.Screen name="DashNotifications" component={NotificationsScreen} options={{ title: 'Notifications' }} />
    </Stack.Navigator>
  );
}

function CoursesStack() {
  const { isDark } = useTheme();
  const so = buildScreenOptions(isDark);
  return (
    <Stack.Navigator screenOptions={so}>
      <Stack.Screen name="ProfCourses" component={ProfessorCourses} options={{ title: 'My Courses' }} />
      <Stack.Screen name="CreateCourse" component={CreateCourseScreen} options={{ title: 'Create Course' }} />
      <Stack.Screen name="ProfCourseDetail" component={ProfCourseDetail} options={({ route }: any) => ({ title: route.params?.courseName || 'Course' })} />
      <Stack.Screen name="ProfStudents" component={ProfStudents} options={({ route }: any) => ({ title: `Students · ${route.params?.courseName || ''}` })} />
      <Stack.Screen name="ManageSchedule" component={ManageSchedule} options={({ route }: any) => ({ title: `Schedule · ${route.params?.courseName || ''}` })} />
      <Stack.Screen name="ProfMaterials" component={ProfMaterials} options={({ route }: any) => ({ title: `Materials · ${route.params?.courseName || ''}` })} />
      <Stack.Screen name="ProfAttendance" component={ProfAttendance} options={({ route }: any) => ({ title: `Attendance · ${route.params?.courseName || ''}` })} />
      <Stack.Screen name="ProfGrades" component={ProfGrades} options={({ route }: any) => ({ title: `Grades · ${route.params?.courseName || ''}` })} />
      <Stack.Screen name="ProfObjections" component={ProfObjections} options={({ route }: any) => ({ title: `Objections · ${route.params?.courseName || ''}` })} />
      <Stack.Screen name="SendAnnouncement" component={SendAnnouncement} options={{ title: 'Send Announcement' }} />
    </Stack.Navigator>
  );
}

function ProfileStack() {
  const { isDark } = useTheme();
  const so = buildScreenOptions(isDark);
  return (
    <Stack.Navigator screenOptions={so}>
      <Stack.Screen name="ProfileMain" component={ProfileScreen} options={{ title: 'Profile' }} />
      <Stack.Screen name="WebOnlyNotice" component={WebOnlyNotice} options={{ title: 'Web Features' }} />
    </Stack.Navigator>
  );
}

export function ProfessorTabs() {
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();

  const TAB_PADDING_TOP = 6;
  const TAB_PADDING_BOTTOM = insets.bottom + 4;
  const tabBarHeight = 60 + insets.bottom;

  const tabBarBg = isDark ? '#1E293B' : colors.neutral[0];
  const tabBarBorder = isDark ? '#334155' : colors.neutral[100];
  const activeColor = colors.primary[isDark ? 300 : 600];
  const inactiveColor = isDark ? '#64748B' : colors.neutral[400];
  const so = buildScreenOptions(isDark);

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: activeColor,
        tabBarInactiveTintColor: inactiveColor,
        tabBarStyle: {
          backgroundColor: tabBarBg,
          borderTopColor: tabBarBorder,
          borderTopWidth: 1,
          height: tabBarHeight,
          paddingTop: TAB_PADDING_TOP,
          paddingBottom: TAB_PADDING_BOTTOM,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: isDark ? 0.3 : 0.05,
          shadowRadius: 8,
          elevation: 8,
        },
        tabBarLabelStyle: {
          ...typography.tabLabel,
          marginTop: 2,
        },
        tabBarIcon: ({ color, focused }) => {
          type IoniconName = keyof typeof Ionicons.glyphMap;
          const iconMap: Record<string, [IoniconName, IoniconName]> = {
            Dashboard: ['home',     'home-outline'    ],
            Courses:   ['book',     'book-outline'    ],
            Schedule:  ['calendar', 'calendar-outline'],
            Profile:   ['person',   'person-outline'  ],
          };
          const [filledIcon, outlineIcon] = iconMap[route.name] ?? ['apps', 'apps-outline'];
          return (
            <View style={styles.tabIconWrap}>
              <Ionicons name={focused ? filledIcon : outlineIcon} size={22} color={color} />
              {focused && (
                <View style={[styles.activeDot, { backgroundColor: activeColor }]} />
              )}
            </View>
          );
        },
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardStack} />
      <Tab.Screen name="Courses" component={CoursesStack} />
      <Tab.Screen
        name="Schedule"
        component={ProfessorSchedule}
        options={{ headerShown: true, ...so, title: 'Schedule' }}
      />
      <Tab.Screen name="Profile" component={ProfileStack} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabIconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 3,
  },
});
