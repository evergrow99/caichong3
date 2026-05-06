import { NextResponse } from "next/server";
import { hasSupabaseServiceConfig } from "@/lib/supabase/server";

export async function GET() {
  const hasCaichongApiKey = Boolean(process.env.CAICHONG_API_KEY);
  const useMock = process.env.CAICHONG_USE_MOCK === "true" || !hasCaichongApiKey;

  return NextResponse.json({
    caichong: {
      baseUrl: process.env.CAICHONG_BASE_URL || "https://main-api.caichong.net",
      hasApiKey: hasCaichongApiKey,
      useMock
    },
    supabase: {
      hasUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
      hasAnonKey: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
      hasServiceRoleKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
      ready: hasSupabaseServiceConfig()
    }
  });
}
