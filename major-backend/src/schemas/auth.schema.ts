import { z } from "zod";

export const studentRegisterSchema = z.object({
    fullName: z.string().min(2, "Full name must be at least 2 characters").max(100),
    email: z.string().email("Invalid email address"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    enrollmentNumber: z.string().min(1, "Enrollment number is required"),
    usn: z.string().optional(),
    branch: z.string().min(1, "Branch is required"),
    department: z.string().optional(),
    course: z.string().optional(),
    programCode: z.string().optional(),
    graduationYear: z.coerce.number().int().min(2020).max(2035),
    semester: z.coerce.number().int().min(1).max(10),
    currentSemester: z.coerce.number().int().min(1).max(10).optional(),
    phone: z.string().optional()
});

export const adminRegisterSchema = z.object({
    fullName: z.string().min(2, "Full name must be at least 2 characters").max(100),
    email: z.string().email("Invalid email address"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    adminSecretKey: z.string().min(1, "Admin secret key is required"),
    employeeId: z.string().min(1, "Employee ID is required"),
    designation: z.string().min(1, "Designation is required"),
    department: z.string().default("Training & Placement"),
    phone: z.string().optional()
});

export const loginSchema = z.object({
    email: z.string().optional(),
    rollNumber: z.string().optional(),
    identifier: z.string().optional(),
    password: z.string().min(1, "Password is required")
}).refine((data) => Boolean(data.email || data.rollNumber || data.identifier), {
    message: "Email, USN, or Enrollment number is required",
    path: ["email"]
});

export const forgotPasswordSchema = z.object({
    email: z.string().email("Invalid email address")
});

export const verifyOtpSchema = z.object({
    email: z.string().email("Invalid email address"),
    otp: z.string().length(6, "OTP must be 6 digits")
});

export const resetPasswordSchema = z.object({
    email: z.string().email("Invalid email address"),
    resetToken: z.string().min(1, "Reset token is required"),
    newPassword: z.string().min(8, "Password must be at least 8 characters")
});
