import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { env } from "../config/env.js";

let supabaseClient: SupabaseClient | null = null;
let supabaseAdmin: SupabaseClient | null = null;

export const getSupabaseClient = (): SupabaseClient => {
    if (!supabaseClient) {
        const apiKey = env.SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY || "dummy-anon-key";
        supabaseClient = createClient(
            env.SUPABASE_URL,
            apiKey,
            {
                auth: {
                    persistSession: false,
                    autoRefreshToken: false
                }
            }
        );
    }
    return supabaseClient;
};

export const getSupabaseAdmin = (): SupabaseClient => {
    if (!supabaseAdmin) {
        const adminKey = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY || "dummy-admin-key";
        supabaseAdmin = createClient(
            env.SUPABASE_URL,
            adminKey,
            {
                auth: {
                    persistSession: false,
                    autoRefreshToken: false
                }
            }
        );
    }
    return supabaseAdmin;
};
