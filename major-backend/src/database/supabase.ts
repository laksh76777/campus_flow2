import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { env } from "../config/env.js";

let supabaseClient: SupabaseClient | null = null;
let supabaseAdmin: SupabaseClient | null = null;

export const getSupabaseClient = (): SupabaseClient => {
    if (!supabaseClient) {
        supabaseClient = createClient(
            env.SUPABASE_URL,
            env.SUPABASE_ANON_KEY || "dummy-anon-key",
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
        supabaseAdmin = createClient(
            env.SUPABASE_URL,
            env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY || "dummy-admin-key",
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
