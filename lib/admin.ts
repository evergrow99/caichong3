import type { CurrentUser } from "@/lib/current-user";

export function isAdminUser(user: CurrentUser) {
  const adminPhones = (process.env.ADMIN_PHONES || "")
    .split(",")
    .map((phone) => phone.trim())
    .filter(Boolean);

  return user.authMode === "phone" && adminPhones.includes(user.phone);
}
