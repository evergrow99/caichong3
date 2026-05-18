import type { CurrentUser } from "@/lib/current-user";

export function getAdminPhones() {
  return (process.env.ADMIN_PHONES || "")
    .split(",")
    .map((phone) => phone.trim())
    .filter(Boolean);
}

export function isAdminPhone(phone: string) {
  return getAdminPhones().includes(phone);
}

export function isAdminUser(user: CurrentUser) {
  return user.authMode === "phone" && isAdminPhone(user.phone);
}
