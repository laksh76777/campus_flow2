import { createServerClient } from "@supabase/ssr";

const supabaseUrl =
  (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_SUPABASE_URL) ||
  "https://tnvmurruroxczwioilfj.supabase.co";

const supabaseKey =
  (typeof process !== "undefined" && (process.env?.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env?.NEXT_PUBLIC_SUPABASE_ANON_KEY)) ||
  "sb_publishable_NDgi3P0IvetQRHaGPs5-ew_5FtJ8VN_";

export const updateSession = (request: any, response: any) => {
  const supabase = createServerClient(
    supabaseUrl,
    supabaseKey,
    {
      cookies: {
        getAll() {
          return request?.cookies?.getAll ? request.cookies.getAll() : [];
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request?.cookies?.set?.(name, value);
            response?.cookies?.set?.(name, value, options);
          });
        },
      },
    }
  );

  return { supabase, response };
};
