import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let serviceClient: SupabaseClient | null = null;

function requireEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`缺少环境变量 ${name}`);
  }

  return value;
}

export function createSupabaseServiceClient() {
  if (serviceClient) {
    return serviceClient;
  }

  serviceClient = createClient(requireEnv("NEXT_PUBLIC_SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  return serviceClient;
}

export function hasSupabaseServiceConfig() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}
