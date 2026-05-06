import { cookies } from "next/headers";
import { AUTH_COOKIE_NAME } from "@/lib/auth-utils";

export type CurrentUser = {
  id: string;
  phone: string;
  displayName: string;
  authMode: "mock" | "phone";
};

const mockUser: CurrentUser = {
  id: "00000000-0000-4000-8000-000000000001",
  phone: "13800000000",
  displayName: "演示用户",
  authMode: "mock"
};

function uuidFromPhone(phone: string) {
  if (phone === mockUser.phone) {
    return mockUser.id;
  }

  const digits = phone.replace(/\D/g, "").padStart(12, "0").slice(-12);
  return `00000000-0000-4000-8000-${digits}`;
}

export async function getCurrentUser(): Promise<CurrentUser> {
  const cookieStore = await cookies();
  const phone = cookieStore.get(AUTH_COOKIE_NAME)?.value;

  if (phone) {
    return {
      id: uuidFromPhone(phone),
      phone,
      displayName: `用户 ${phone.slice(-4)}`,
      authMode: "phone"
    };
  }

  return mockUser;
}

export function createDevPhoneUser(phone: string): CurrentUser {
  return {
    id: uuidFromPhone(phone),
    phone,
    displayName: `用户 ${phone.slice(-4)}`,
    authMode: "phone"
  };
}
