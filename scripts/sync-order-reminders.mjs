import fs from "node:fs";
import path from "node:path";

const DEFAULT_INTERVAL_MINUTES = 5;

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    if (!key || process.env[key]) continue;

    process.env[key] = rawValue.replace(/^['"]|['"]$/g, "");
  }
}

function getIntervalMs() {
  const minutes = Number(process.env.ORDER_REMINDER_SYNC_INTERVAL_MINUTES || DEFAULT_INTERVAL_MINUTES);
  return Math.max(1, Number.isFinite(minutes) ? minutes : DEFAULT_INTERVAL_MINUTES) * 60 * 1000;
}

async function syncOnce() {
  const baseUrl = process.env.APP_BASE_URL || `http://127.0.0.1:${process.env.PORT || 3000}`;
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.error("[order-reminders] Missing CRON_SECRET");
    return;
  }

  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/api/sync/order-reminders`, {
      headers: {
        Authorization: `Bearer ${cronSecret}`
      }
    });
    const text = await response.text();
    console.log(`[order-reminders] ${new Date().toISOString()} ${response.status} ${text}`);
  } catch (error) {
    console.error("[order-reminders] sync failed", error);
  }
}

loadEnvFile(path.join(process.cwd(), ".env.production"));
loadEnvFile(path.join(process.cwd(), ".env.local"));

await syncOnce();
setInterval(syncOnce, getIntervalMs());
