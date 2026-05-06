import type { CurrentUser } from "@/lib/current-user";

export type PublishMode = "PLATFORM_AGENT" | "USER_AGENT";

export type CaichongAccount = {
  id: string;
  ownerUserId: string | null;
  mode: PublishMode;
  apiKey?: string;
  label: string;
};

export type TaskServiceContext = {
  user: CurrentUser;
  account: CaichongAccount;
};

export function getPlatformCaichongAccount(): CaichongAccount {
  return {
    id: "00000000-0000-4000-8000-000000000100",
    ownerUserId: null,
    mode: "PLATFORM_AGENT",
    apiKey: process.env.CAICHONG_API_KEY,
    label: "平台代理 Agent"
  };
}

export async function resolvePublishingAccount(user: CurrentUser): Promise<CaichongAccount> {
  // MVP default: all users publish through the platform agent.
  // Later this function can return a user-owned Agent account when the user binds one.
  return getPlatformCaichongAccount();
}
