export type UserRole = 'student' | 'professor' | 'admin' | 'user';
export type UserStatus = 'active' | 'pending' | 'rejected';

export interface UserProfile {
  id: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  plan: string | null;
  subscription_start_date: string | null;
  subscription_end_date: string | null;
  subscription_status: string | null;
  created_at: string;
  updated_at: string;
}

export interface Course {
  id: string;
  code: string;
  name: string;
  description: string | null;
  department: string | null;
  semester: string | null;
  year: number | null;
  is_active: boolean;
  is_plan_locked: boolean;
  created_by: string;
  total_lectures_held: number;
  is_attendance_published: boolean;
  created_at: string;
  user_profiles?: { first_name: string | null; last_name: string | null };
}

export interface Enrollment {
  id: string;
  student_id: string;
  course_id: string;
  enrolled_at: string;
  is_blocked: boolean;
  blocked_at: string | null;
  blocked_by: string | null;
}

export interface Lecture {
  id: string;
  course_id: string;
  title: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  location: string | null;
  type: 'lecture' | 'section';
  is_cancelled: boolean;
  cancelled_reason: string | null;
  created_by: string;
}

export interface Grade {
  id: string;
  student_id: string;
  course_id: string;
  exam_type: string;
  score: number;
  max_score: number | null;
  is_published: boolean;
  published_by: string;
  published_at: string;
}

export interface GradeObjection {
  id: string;
  student_id: string;
  course_id: string;
  instructor_id: string;
  exam_name: string;
  current_grade: number;
  objection_reason: string;
  status: 'pending' | 'approved' | 'rejected' | 'adjusted';
  instructor_response: string | null;
  adjusted_score: number | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}

export interface AttendanceSession {
  id: string;
  course_id: string;
  lecture_id: string;
  professor_id: string;
  opened_at: string;
  closed_at: string | null;
  professor_latitude: number | null;
  professor_longitude: number | null;
  is_active: boolean;
  lecture_date: string | null;
  radius_meters: number;
}

export interface AttendanceRecord {
  id: string;
  session_id: string;
  student_id: string;
  marked_at: string;
  distance_meters: number;
  student_latitude: number;
  student_longitude: number;
  status: 'present' | 'late' | 'absent';
  marked_manually: boolean;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'grade' | 'schedule' | 'course_announcement';
  is_read: boolean;
  link: string | null;
  created_at: string;
}

export interface CourseMaterial {
  id: string;
  course_id: string;
  title: string;
  description: string | null;
  file_url: string;
  file_type: string;
  file_size: number;
  material_type: string;
  uploaded_by: string;
  is_pinned: boolean;
  pinned_at: string | null;
  order_index: number;
  created_at: string;
}
