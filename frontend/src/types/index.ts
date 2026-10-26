export interface ApiResponse<T = any> {
  statusCode: number;
  data: T;
  message: string;
  success: boolean;
}

export interface User {
  id?: string;
  _id?: string;
  fullName: string;
  email: string;
  role: "student" | "admin";
  phone?: string;
  avatar?: string;
  [key: string]: any;
}

export interface StudentProfile {
  id?: string;
  _id?: string;
  user_id?: string;
  enrollment_number?: string;
  usn?: string;
  branch?: string;
  department?: string;
  course?: string;
  program_code?: string;
  graduation_year?: number;
  semester?: number;
  current_semester?: number;
  section?: string;
  cgpa?: number;
  verified_cgpa?: number;
  backlogs?: number;
  active_backlogs?: number;
  historical_backlogs?: number;
  tenth_details?: Record<string, any>;
  twelfth_or_diploma_details?: Record<string, any>;
  tenth_percentage?: number;
  twelfth_percentage?: number;
  has_education_gap?: boolean;
  education_gaps?: any[];
  semester_results?: any[];
  skills?: string[];
  certificates?: any[];
  about?: string;
  resume_url?: string;
  verification_status?: "PENDING" | "VERIFIED" | "REJECTED" | "REVERIFICATION_REQUESTED";
  verification_remarks?: string;
  profile_completeness?: number;
  is_placed?: boolean;
  placed_company?: string;
  placed_package?: number;
  is_profile_locked?: boolean;
  modification_requests?: any[];
  current_address?: Record<string, any>;
  permanent_address?: Record<string, any>;
  family?: Record<string, any>;
  personal_email?: string;
  college_email?: string;
  [key: string]: any;
}

export interface Company {
  id?: string;
  _id?: string;
  company_name: string;
  company_description?: string;
  company_website?: string;
  company_logo_url?: string;
  industry?: string;
  location?: string;
  contact_email?: string;
  contact_phone?: string;
  is_active?: boolean;
  [key: string]: any;
}

export interface EligibilityResult {
  status: "ELIGIBLE" | "INELIGIBLE" | "MISSING_DATA";
  isEligible: boolean;
  summary: string;
  reasons: string[];
  missingFields: string[];
  criteriaBreakdown: Array<{
    criterion: string;
    required: string;
    actual: string;
    passed: boolean;
  }>;
  [key: string]: any;
}

export interface PlacementDrive {
  id?: string;
  _id?: string;
  company_id?: string;
  company_name?: string;
  company_logo_url?: string;
  company?: Company;
  job_title: string;
  job_description?: string;
  job_type?: "full-time" | "internship" | "internship-to-full-time";
  internship_type?: "paid" | "unpaid" | "not_applicable";
  stipend?: string;
  internship_duration?: string;
  jd_pdf_url?: string;
  jd_pdf_filename?: string;
  package?: number;
  location?: string;
  eligible_branches?: string[];
  minimum_cgpa?: number;
  maximum_backlogs?: number;
  graduation_year?: number;
  application_deadline?: string;
  drive_date?: string;
  venue?: string;
  application_link?: string;
  is_active?: boolean;
  selection_rounds?: any[];
  custom_questions?: any[];
  eligibility?: EligibilityResult;
  [key: string]: any;
}

export interface Application {
  id?: string;
  _id?: string;
  student_id?: string;
  placement_drive_id?: string;
  status: string;
  applied_at?: string;
  interview_date?: string;
  interview_round?: string;
  interview_location?: string;
  offered_package?: number;
  remarks?: string;
  job_title?: string;
  company_name?: string;
  company_logo_url?: string;
  package?: number;
  drive_date?: string;
  application_deadline?: string;
  venue?: string;
  [key: string]: any;
}

export interface NotificationItem {
  id?: string;
  _id?: string;
  title: string;
  message: string;
  type?: string;
  status?: string;
  company_name?: string;
  job_title?: string;
  is_read?: boolean;
  created_at?: string;
  [key: string]: any;
}

export type Notification = NotificationItem;

export interface PlacementSession {
  id?: string;
  _id?: string;
  session_year: number;
  name: string;
  academic_year?: string;
  description?: string;
  is_active?: boolean;
  status?: string;
  admission_year_mapping?: any[];
  target_placement_percentage?: number;
  [key: string]: any;
}
