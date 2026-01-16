import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY as string | undefined;

export const supabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

const stub = {
  auth: {
    getSession: async () => ({ data: { session: null } })
  }
};

export const supabase = (() => {
  if (!supabaseConfigured) {
    return stub;
  }
  try {
    return createClient(SUPABASE_URL as string, SUPABASE_ANON_KEY as string);
  } catch {
    return stub;
  }
})();
