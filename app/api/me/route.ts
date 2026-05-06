import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { ensureUserProfile } from "@/lib/user-profile";

export async function GET() {
  const user = await getCurrentUser();
  await ensureUserProfile(user);
  return NextResponse.json(user);
}
