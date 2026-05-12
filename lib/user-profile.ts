import type { CurrentUser } from "@/lib/current-user";
import { hasSupabaseServiceConfig, createSupabaseServiceClient } from "@/lib/supabase/server";

export type AdminUser = {
  id: string;
  phone?: string;
  displayName?: string;
  createdAt?: string;
  lastLoginAt?: string;
  orderCount: number;
};

type ProfileRow = {
  id: string;
  phone: string | null;
  display_name: string | null;
  created_at: string | null;
  last_login_at?: string | null;
};

type OrderUserRow = {
  user_id: string;
};

const internalTestPhones = new Set(["13700000000", "13800000000", "13900000000"]);
const internalTestUserIds = new Set(["00000000-0000-4000-8000-000000000001"]);

function isInternalTestProfile(profile: Pick<ProfileRow, "id" | "phone" | "display_name">) {
  return (
    internalTestUserIds.has(profile.id) ||
    Boolean(profile.phone && internalTestPhones.has(profile.phone)) ||
    profile.display_name === "演示用户"
  );
}

function mapAdminUsers(profileRows: ProfileRow[], orderRows: OrderUserRow[]): AdminUser[] {
  const orderCounts = orderRows.reduce<Record<string, number>>((counts, row) => {
    counts[row.user_id] = (counts[row.user_id] || 0) + 1;
    return counts;
  }, {});

  return profileRows
    .filter((profile) => !isInternalTestProfile(profile))
    .map((profile) => ({
      id: profile.id,
      phone: profile.phone || undefined,
      displayName: profile.display_name || undefined,
      createdAt: profile.created_at || undefined,
      lastLoginAt: profile.last_login_at || undefined,
      orderCount: orderCounts[profile.id] || 0
    }));
}

async function upsertProfile(user: CurrentUser, markLogin: boolean) {
  const supabase = createSupabaseServiceClient();
  const profilePatch: Record<string, string> = {
    id: user.id,
    phone: user.phone,
    display_name: user.displayName
  };

  if (markLogin) {
    profilePatch.last_login_at = new Date().toISOString();
  }

  const { error } = await supabase.from("profiles").upsert(profilePatch);

  if (!error) {
    return;
  }

  if (markLogin && (error.code === "PGRST204" || error.message.includes("last_login_at"))) {
    const { error: fallbackError } = await supabase.from("profiles").upsert({
      id: user.id,
      phone: user.phone,
      display_name: user.displayName
    });

    if (fallbackError) {
      throw new Error(`写入用户资料失败：${fallbackError.message}`);
    }

    return;
  }

  throw new Error(`写入用户资料失败：${error.message}`);
}

export async function ensureUserProfile(user: CurrentUser, options: { markLogin?: boolean } = {}) {
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

  await upsertProfile(user, Boolean(options.markLogin));
}

export async function listAdminUsers() {
  if (!hasSupabaseServiceConfig()) {
    return [];
  }

  const supabase = createSupabaseServiceClient();
  let profileRows: ProfileRow[] = [];
  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, phone, display_name, created_at, last_login_at")
    .order("created_at", { ascending: false })
    .limit(300);

  if (profilesError) {
    if (profilesError.code !== "PGRST204" && !profilesError.message.includes("last_login_at")) {
      throw new Error(`读取用户列表失败：${profilesError.message}`);
    }

    const { data: fallbackProfiles, error: fallbackError } = await supabase
      .from("profiles")
      .select("id, phone, display_name, created_at")
      .order("created_at", { ascending: false })
      .limit(300);

    if (fallbackError) {
      throw new Error(`读取用户列表失败：${fallbackError.message}`);
    }

    profileRows = (fallbackProfiles || []) as ProfileRow[];
  } else {
    profileRows = (profiles || []) as ProfileRow[];
  }

  const { data: orderUsers, error: orderError } = await supabase.from("orders").select("user_id").range(0, 9999);

  if (orderError) {
    throw new Error(`统计用户发单数量失败：${orderError.message}`);
  }

  return mapAdminUsers(profileRows, (orderUsers || []) as OrderUserRow[]);
}
