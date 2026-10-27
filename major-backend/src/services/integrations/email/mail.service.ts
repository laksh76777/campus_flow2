import nodemailer, { Transporter } from "nodemailer";
import { env } from "../../../config/env.js";

let transporter: Transporter | null = null;

export const validateEmailAddress = (email?: string | null): boolean => {
    if (!email || typeof email !== "string") return false;
    const trimmed = email.trim();
    return /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/.test(trimmed);
};

export const isPlaceholderValue = (val?: string | null): boolean => {
    if (!val || typeof val !== "string") return false;
    const lower = val.trim().toLowerCase();
    const placeholders = [
        "your_email", "your_app_password", "your_password", "placeholder",
        "changeme", "example.com", "user@example.com", "xxxx", "****", "dummy"
    ];
    return (
        placeholders.some((p) => lower.includes(p)) ||
        lower.startsWith("<") ||
        lower.endsWith(">")
    );
};

export const isResendConfigured = (): boolean => {
    const key = (env.RESEND_API_KEY || "").trim();
    return Boolean(key && !isPlaceholderValue(key));
};

export const getSmtpConfigStatus = () => {
    const resendActive = isResendConfigured();
    if (resendActive) {
        return {
            configured: true,
            hasUser: true,
            hasPass: true,
            isPlaceholder: false,
            host: "api.resend.com (HTTPS API / Port 443)",
            port: 443,
            secure: true,
            sender: env.EMAIL_FROM,
            missing: [],
            isHttpApi: true
        };
    }

    const emailUser = (env.EMAIL_USER || "").trim();
    const emailPass = (env.EMAIL_PASS || "").trim();
    const hasUser = Boolean(emailUser);
    const hasPass = Boolean(emailPass);
    const isPlaceholder = isPlaceholderValue(emailUser) || isPlaceholderValue(emailPass);

    const missing: string[] = [];
    if (!hasUser) missing.push("EMAIL_USER");
    if (!hasPass) missing.push("EMAIL_PASS");

    return {
        configured: Boolean(hasUser && hasPass && !isPlaceholder),
        hasUser,
        hasPass,
        isPlaceholder,
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        secure: env.SMTP_SECURE === "tls" || env.SMTP_PORT === 465,
        sender: env.EMAIL_FROM,
        missing,
        isHttpApi: false
    };
};

export const validateEmailConfigOnStartup = (): { provider: string; configured: boolean; sender: string } => {
    if (isResendConfigured()) {
        console.log(`[EMAIL] Active provider: Resend HTTPS API (Sender: ${env.EMAIL_FROM})`);
        return { provider: "resend", configured: true, sender: env.EMAIL_FROM };
    }
    const smtp = getSmtpConfigStatus();
    if (smtp.configured) {
        console.log(`[EMAIL] Active provider: SMTP (${smtp.host}:${smtp.port}, Sender: ${env.EMAIL_FROM})`);
        return { provider: "smtp", configured: true, sender: env.EMAIL_FROM };
    }
    console.log("[EMAIL] No external email provider configured. Emails will run in simulated development mode.");
    return { provider: "none", configured: false, sender: env.EMAIL_FROM };
};

const sendViaResend = async (options: {
    to: string;
    subject: string;
    html: string;
}): Promise<{ success: boolean; messageId?: string; status: string; error?: string }> => {
    try {
        const res = await fetch("https://api.resend.com/emails", {
            method: "POST",
            signal: AbortSignal.timeout(10000),
            headers: {
                Authorization: `Bearer ${env.RESEND_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                from: env.EMAIL_FROM,
                to: options.to,
                subject: options.subject,
                html: options.html
            })
        });

        const data: any = await res.json().catch(() => ({}));

        if (!res.ok) {
            const errorMessage = data?.message || `HTTP ${res.status}: ${res.statusText}`;
            console.warn(`[EMAIL] Resend API error (${res.status}): ${errorMessage}`);
            return {
                success: false,
                status: res.status === 429 ? "THROTTLED" : "FAILED",
                error: errorMessage
            };
        }

        return {
            success: true,
            messageId: data?.id,
            status: "ACCEPTED"
        };
    } catch (err: any) {
        const isTimeout = err?.name === "TimeoutError" || err?.name === "AbortError";
        const message = isTimeout ? "Resend API connection timed out (10s limit)" : (err?.message || "Network error");
        console.error("[EMAIL] Resend dispatch failure:", message);
        return {
            success: false,
            status: isTimeout ? "TIMEOUT" : "FAILED",
            error: message
        };
    }
};

const getTransporter = (): Transporter | null => {
    const status = getSmtpConfigStatus();
    if (!status.configured) return null;

    if (!transporter) {
        transporter = nodemailer.createTransport({
            host: env.SMTP_HOST,
            port: env.SMTP_PORT,
            secure: env.SMTP_SECURE === "ssl" || env.SMTP_PORT === 465,
            auth: {
                user: env.EMAIL_USER,
                pass: env.EMAIL_PASS
            }
        });
    }
    return transporter;
};

export const sendEmail = async (options: {
    to: string;
    subject: string;
    html: string;
}): Promise<{ success: boolean; messageId?: string; status?: string; simulated?: boolean; error?: string }> => {
    if (!validateEmailAddress(options.to)) {
        return { success: false, status: "INVALID_RECIPIENT", error: "Invalid recipient email address" };
    }

    // Try Resend HTTPS API first if configured
    if (isResendConfigured()) {
        const resendRes = await sendViaResend(options);
        if (resendRes.success) {
            return { success: true, messageId: resendRes.messageId, status: resendRes.status };
        }
        console.warn("[EMAIL] Resend API failed. Attempting fallback to SMTP transport...");
    }

    const t = getTransporter();
    if (!t) {
        console.log(`[SIMULATED EMAIL] To: ${options.to} | Subject: ${options.subject}`);
        return { success: true, status: "SIMULATED", simulated: true };
    }

    try {
        const info = await t.sendMail({
            from: env.EMAIL_FROM,
            to: options.to,
            subject: options.subject,
            html: options.html
        });
        return { success: true, messageId: info.messageId, status: "SENT" };
    } catch (err: any) {
        console.error("[EMAIL] SMTP dispatch failure:", err?.message || err);
        return { success: false, status: "FAILED", error: err?.message || "SMTP error" };
    }
};

export const sendOtpEmail = async (email: string, otp: string): Promise<boolean> => {
    const html = `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px;">
            <h2 style="color: #2549e8; margin-top: 0;">CampusFlow Password Reset</h2>
            <p>You recently requested to reset your password for your CampusFlow account.</p>
            <div style="background-color: #f1f5f9; padding: 16px; border-radius: 6px; text-align: center; font-size: 28px; font-weight: bold; letter-spacing: 4px; color: #0f172a; margin: 24px 0;">
                ${otp}
            </div>
            <p style="font-size: 13px; color: #64748b;">This OTP code is valid for 10 minutes. If you did not request this, please ignore this email.</p>
        </div>
    `;
    const res = await sendEmail({ to: email, subject: "CampusFlow - Password Reset Code", html });
    return res.success;
};

export const sendDeadlineReminderEmail = async (
    email: string,
    studentName: string,
    driveDetails: {
        companyName: string;
        jobTitle: string;
        package: number;
        deadline: string;
        driveId: string;
    }
): Promise<{ success: boolean; messageId?: string; status?: string; error?: string }> => {
    const appUrl = `${env.FRONTEND_URL}/placement-drives`;
    const html = `
        <div style="font-family: Arial, sans-serif; max-width: 550px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px;">
            <div style="font-size: 13px; font-weight: bold; color: #e11d48; text-transform: uppercase;">Urgent Deadline Reminder</div>
            <h2 style="color: #0f172a; margin-top: 8px;">${driveDetails.companyName} Application Closing Soon</h2>
            <p>Dear ${studentName || "Student"},</p>
            <p>The application window for <strong>${driveDetails.jobTitle}</strong> at <strong>${driveDetails.companyName}</strong> is closing soon.</p>
            <div style="background-color: #f8fafc; padding: 16px; border-radius: 6px; margin: 20px 0;">
                <div><strong>Role:</strong> ${driveDetails.jobTitle}</div>
                <div><strong>Compensation:</strong> ₹${driveDetails.package} LPA</div>
                <div><strong>Application Deadline:</strong> ${new Date(driveDetails.deadline).toLocaleString()}</div>
            </div>
            <a href="${appUrl}" style="display: inline-block; background-color: #2549e8; color: #ffffff; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: bold;">
                Apply Now in Student Portal
            </a>
        </div>
    `;
    const res = await sendEmail({
        to: email,
        subject: `[Deadline Reminder] ${driveDetails.companyName} Application Closing Soon`,
        html
    });
    return {
        success: res.success,
        messageId: res.messageId,
        status: res.status,
        error: res.error
    };
};
