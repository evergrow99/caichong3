import { ensureUserProfile } from "@/lib/user-profile";
import type { CurrentUser } from "@/lib/current-user";

export async function ensureDevUser(user: CurrentUser) {
  return ensureUserProfile(user);
}
