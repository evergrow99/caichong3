import { createCaichongClient } from "@/lib/caichong";
import type { CurrentUser } from "@/lib/current-user";
import { resolvePublishingAccount } from "@/lib/caichong-account";
import { mockCaichong } from "@/lib/mock-caichong";

type TaskServiceOptions = {
  queryRetryDelaysMs?: number[];
  queryTimeoutMs?: number;
};

export function isUsingMockCaichong(apiKey?: string) {
  if (process.env.CAICHONG_USE_MOCK === "true") return true;
  if (apiKey) return false;
  return process.env.CAICHONG_USE_MOCK === "true" || !process.env.CAICHONG_API_KEY;
}

export async function getTaskService(user: CurrentUser, options: TaskServiceOptions = {}) {
  const account = await resolvePublishingAccount(user);

  if (isUsingMockCaichong(account.apiKey)) {
    return {
      account,
      source: "mock" as const,
      service: mockCaichong
    };
  }

  return {
    account,
    source: "caichong" as const,
    service: createCaichongClient({ apiKey: account.apiKey, ...options })
  };
}
