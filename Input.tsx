import React from 'react';
import { View, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StudentDashboard } from '../screens/student/StudentDashboard';
import { StudentCourses } from '../screens/student/StudentCourses';
import { StudentSchedule } from '../screens/student/StudentSchedule';
import { StudentGrades } from '../screens/student/StudentGrades';
import { ProfileScreen } from '../screens/shared/ProfileScreen';
import { StudentCourseDetail } from '../screens/student/StudentCourseDetail';
import { JoinCourseScreen } from '../screens/student/JoinCourseScreen';
import { MarkAttendanceScreen } from '../screens/student/MarkAttendanceScreen';
import { NotificationsScreen } from '../screens/shared/NotificationsScreen';
import { WebOnlyNotice } from '../screens/shared/WebOnlyNotice';
import { MaterialViewer } from '../screens/shared/MaterialViewer';
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
      <Stack.Screen name="StudentHome" component={StudentDashboard} options={{ title: 'Dashboard' }} />
      <Stack.Screen name="JoinCourse" component={JoinCourseScreen} options={{ title: 'Join Course' }} />
      <Stack.Screen name="DashNotifications" component={NotificationsScreen} options={{ title: 'Notifications' }} />
    </Stack.Navigator>
  );
}

function CoursesStack() {
  const { isDark } = useTheme();
  const so = buildScreenOptions(isDark);
  return (
    <Stack.Navigator screenOptions={so}>
      <Stack.Screen name="CoursesList" component={StudentCourses} options={{ title: 'My Courses' }} />
      <Stack.Screen name="CourseDetail" component={StudentCourseDetail} options={({ route }: any) => ({ title: route.params?.courseName || 'Course' })} />
      <Stack.Screen name="MarkAttendance" component={MarkAttendanceScreen} options={{ title: 'Mark Attendance' }} />
      <Stack.Screen name="MaterialViewer" component={MaterialViewer} options={{ title: 'Material', headerShown: false }} />
    </Stack.Navigator>
  );
}

function GradesStack() {
  const { isDark } = useTheme();
  const so = buildScreenOptions(isDark);
  return (
    <Stack.Navigator screenOptions={so}>
      <Stack.Screen name="GradesList" component={StudentGrades} options={{ title: 'Grades' }} />
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

export function StudentTabs() {
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
            Dashboard: ['home',        'home-outline'       ],
            Courses:   ['book',        'book-outline'       ],
            Schedule:  ['calendar',    'calendar-outline'   ],
            Grades:    ['school',      'school-outline'     ],
            Profile:   ['person',      'person-outline'     ],
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
      <Tab.Screen
        name="Courses"
        component={CoursesStack}
        listeners={({ navigation }) => ({
          tabPress: () => {
            navigation.navigate('Courses', { screen: 'CoursesList' });
          },
        })}
      />
      <Tab.Screen
        name="Schedule"
        component={StudentSchedule}
        options={{ headerShown: true, ...so, title: 'Schedule' }}
      />
      <Tab.Screen name="Grades" component={GradesStack} />
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
