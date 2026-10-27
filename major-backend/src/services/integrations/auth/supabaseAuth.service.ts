import { getSupabaseAdmin, getSupabaseClient } from "../../../database/supabase.js";

/**
 * Creates or synchronizes a user in Supabase Auth
 */
export const syncUserToSupabaseAuth = async (params: {
    id: string;
    email: string;
    password?: string;
    role: "student" | "admin";
    fullName: string;
}): Promise<void> => {
    try {
        const admin = getSupabaseAdmin();
        const { error } = await admin.auth.admin.createUser({
            id: params.id,
            email: params.email,
            password: params.password,
            email_confirm: true,
            user_metadata: {
                role: params.role,
                full_name: params.fullName
            }
        });

        if (error && error.message.includes("already registered")) {
            // If already exists, sync password and metadata
            if (params.password) {
                await admin.auth.admin.updateUserById(params.id, {
                    password: params.password,
                    email_confirm: true,
                    user_metadata: {
                        role: params.role,
                        full_name: params.fullName
                    }
                });
            }
        }
    } catch (err: any) {
        console.warn(`[Supabase Auth Sync] Warning syncing user ${params.email}:`, err?.message);
    }
};

/**
 * Updates a user's password in Supabase Auth
 */
export const updateSupabaseAuthPassword = async (userId: string, newPassword: string): Promise<boolean> => {
    try {
        const admin = getSupabaseAdmin();
        const { error } = await admin.auth.admin.updateUserById(userId, {
            password: newPassword,
            email_confirm: true
        });
        return !error;
    } catch {
        return false;
    }
};

/**
 * Attempts direct Supabase Auth sign-in with email & password
 */
export const signInWithSupabase = async (
    email: string,
    password: string
): Promise<{ accessToken?: string; refreshToken?: string } | null> => {
    try {
        const client = getSupabaseClient();
        const { data, error } = await client.auth.signInWithPassword({
            email,
            password
        });

        if (error || !data.session) {
            return null;
        }

        return {
            accessToken: data.session.access_token,
            refreshToken: data.session.refresh_token
        };
    } catch {
        return null;
    }
};
