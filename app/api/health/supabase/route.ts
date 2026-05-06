import { NextResponse } from "next/server";
import { createSupabaseServiceClient, hasSupabaseServiceConfig } from "@/lib/supabase/server";

export async function GET() {
  if (!hasSupabaseServiceConfig()) {
    return NextResponse.json(
      {
        ok: false,
        error: "Supabase service config is missing"
      },
      { status: 500 }
    );
  }

  const supabase = createSupabaseServiceClient();
  const { error } = await supabase.from("profiles").select("id").limit(1);

  if (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error.message
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true
  });
}
