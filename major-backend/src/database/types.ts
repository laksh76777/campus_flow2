export interface UserRecord {
    id: string;
    full_name: string;
    email: string;
    password_hash: string;
    role: "student" | "admin";
    phone?: string | null;
    avatar_url?: string | null;
    avatar_public_id?: string | null;
    is_email_verified: boolean;
    is_active: boolean;
    last_login_at?: Date | string | null;
    refresh_token?: string | null;
    created_at: string;
    updated_at: string;
}

export interface AdminRecord {
    id: string;
    user_id: string;
    employee_id: string;
    designation: string;
    department: string;
    is_placement_officer: boolean;
    created_at: string;
    updated_at: string;
}

export interface PlacementSessionRecord {
    id: string;
    session_year: number;
    name: string;
    academic_year?: string;
    description?: string;
    is_active: boolean;
    is_closed: boolean;
    is_archived: boolean;
    status: "UPCOMING" | "ACTIVE" | "CLOSED" | "ARCHIVED";
    start_date?: string;
    end_date?: string | null;
    admission_year_mapping: Array<{
        course: string;
        courseDurationYears: number;
        admissionYear: number;
    }>;
    target_placement_percentage: number;
    created_by?: string | null;
    created_at: string;
    updated_at: string;
}

export interface DepartmentRecord {
    id: string;
    name: string;
    code: string;
    course?: string | null;
    program_level?: "Undergraduate" | "Postgraduate" | null;
    degree_type?: "B.E." | "MBA" | "MCA" | "M.Tech" | null;
    college?: string;
    is_active: boolean;
    description?: string;
    created_by?: string | null;
    created_at: string;
    updated_at: string;
}

export interface CompanyRecord {
    id: string;
    company_name: string;
    company_description?: string;
    company_website?: string;
    company_logo_url?: string;
    company_logo_public_id?: string;
    industry?: string;
    location?: string;
    contact_email?: string;
    contact_phone?: string;
    is_active: boolean;
    created_by?: string | null;
    created_at: string;
    updated_at: string;
}

export interface StudentProfileRecord {
    id: string;
    user_id: string;
    enrollment_number: string;
    usn?: string | null;
    course?: string | null;
    program_code?: string | null;
    program_level?: string | null;
    degree_type?: string | null;
    branch: string;
    department?: string | null;
    admission_year?: number | null;
    graduation_year: number;
    semester: number;
    current_semester?: number | null;
    section?: string;
    placement_session_id?: string | null;
    gender?: string;
    dob?: string | null;
    personal_email?: string;
    college_email?: string;
    alternate_phone?: string;
    aadhar_number?: string;
    family?: Record<string, any>;
    current_address?: Record<string, any>;
    permanent_address?: Record<string, any>;
    same_as_current: boolean;
    tenth_details?: Record<string, any>;
    twelfth_or_diploma_details?: Record<string, any>;
    tenth_percentage?: number | null;
    twelfth_percentage?: number | null;
    has_education_gap: boolean;
    education_gaps?: any[];
    semester_results?: any[];
    cgpa?: number | null;
    verified_cgpa?: number | null;
    backlogs: number;
    active_backlogs: number;
    historical_backlogs: number;
    cleared_backlogs_count: number;
    backlog_details?: any[];
    skills?: string[];
    certificates?: any[];
    about?: string;
    resume_url?: string;
    resume_public_id?: string;
    verification_status: "PENDING" | "VERIFIED" | "REJECTED" | "REVERIFICATION_REQUESTED";
    verified_by?: string | null;
    verified_at?: string | null;
    verification_remarks?: string;
    profile_completeness: number;
    is_placed: boolean;
    placed_company?: string;
    placed_package?: number | null;
    placed_at?: string | null;
    placed_job_title?: string;
    is_profile_locked: boolean;
    profile_locked_at?: string | null;
    modification_requests?: any[];
    created_at: string;
    updated_at: string;
}

export interface PlacementDriveRecord {
    id: string;
    company_id: string;
    job_title: string;
    job_description?: string;
    job_type: "full-time" | "internship" | "internship-to-full-time";
    internship_type?: "paid" | "unpaid" | "not_applicable";
    stipend?: string;
    internship_duration?: string;
    jd_pdf_url?: string;
    jd_pdf_filename?: string;
    package: number;
    location?: string;
    eligible_branches: string[];
    eligible_program_codes?: string[];
    minimum_cgpa: number;
    maximum_backlogs: number;
    maximum_historical_backlogs?: number | null;
    graduation_year: number;
    placement_session_id?: string | null;
    check_cgpa: boolean;
    check_backlogs: boolean;
    check_tenth_marks: boolean;
    minimum_tenth_percentage: number;
    check_twelfth_marks: boolean;
    minimum_twelfth_percentage: number;
    check_education_gaps: boolean;
    allow_education_gaps: boolean;
    max_education_gap_years: number;
    custom_questions?: any[];
    reminder_settings?: {
        remindersEnabled: boolean;
        reminderOffsetsHours: number[];
        channels: string[];
    };
    selection_rounds?: any[];
    current_round_number: number;
    student_requirements?: Record<string, any>;
    application_start_date: string;
    application_deadline: string;
    drive_date: string;
    venue?: string;
    application_link?: string;
    is_active: boolean;
    created_by: string;
    created_at: string;
    updated_at: string;
}

export interface ApplicationRecord {
    id: string;
    student_id: string;
    placement_drive_id: string;
    status:
        | "applied"
        | "shortlisted"
        | "interview"
        | "selected"
        | "rejected"
        | "on_hold"
        | "offer_received"
        | "offer_accepted"
        | "offer_declined"
        | "withdrawn";
    applied_at: string;
    interview_date?: string | null;
    interview_round?: string;
    interview_location?: string;
    interview_rounds?: any[];
    offered_package?: number | null;
    offer_details?: Record<string, any>;
    remarks?: string;
    status_updated_at?: string | null;
    is_archived: boolean;
    archived_at?: string | null;
    archived_drive_snapshot?: Record<string, any>;
    eligibility_snapshot?: Record<string, any>;
    is_overridden: boolean;
    override_reason?: string;
    overridden_by?: string | null;
    overridden_at?: string | null;
    status_history?: any[];
    custom_answers?: any[];
    submitted_snapshot?: Record<string, any>;
    created_at: string;
    updated_at: string;
}

export interface NotificationRecord {
    id: string;
    user_id: string;
    title: string;
    message: string;
    type?: string;
    status?: string;
    company_name?: string;
    job_title?: string;
    remarks?: string;
    interview_date?: string | null;
    interview_round?: string;
    interview_location?: string;
    offered_package?: number | null;
    is_read: boolean;
    application_id?: string | null;
    broadcast_id?: string;
    created_at: string;
    updated_at: string;
}

export interface ReminderJobRecord {
    id: string;
    drive_id: string;
    idempotency_key: string;
    offset_hours: number;
    scheduled_time: string;
    drive_deadline: string;
    channels: string[];
    status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED" | "CANCELLED";
    in_app_completed: boolean;
    email_completed: boolean;
    attempts: number;
    max_attempts: number;
    last_attempt_at?: string | null;
    error_category?: string;
    delivery_summary?: Record<string, any>;
    created_at: string;
    updated_at: string;
}

export interface SupportConversationRecord {
    id: string;
    student_id: string;
    subject: string;
    status: "open" | "answered" | "bot_answered" | "closed";
    messages: any[];
    last_message_at: string;
    assigned_admin?: string | null;
    created_at: string;
    updated_at: string;
}
