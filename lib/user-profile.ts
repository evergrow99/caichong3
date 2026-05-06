import type { CurrentUser } from "@/lib/current-user";
import { hasSupabaseServiceConfig, createSupabaseServiceClient } from "@/lib/supabase/server";

export async function ensureUserProfile(user: CurrentUser) {
  if (!hasSupabaseServiceConfig()) {
    return;
  }

  const supabase = createSupabaseServiceClient();
  const existing = await supabase.auth.admin.getUserById(user.id);

  if (existing.error) {
    const created = await supabase.auth.admin.createUser({
      id: user.id,
      phone: user.phone,
      phone_confirm: true,
      user_metadata: {
        display_name: user.displayName
      }
    });

    if (created.error) {
      throw new Error(`创建用户失败：${created.error.message}`);
    }
  }

  const { error } = await supabase.from("profiles").upsert({
    id: user.id,
    phone: user.phone,
    display_name: user.displayName
  });

  if (error) {
    throw new Error(`写入用户资料失败：${error.message}`);
  }
}
