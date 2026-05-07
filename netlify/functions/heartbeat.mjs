export default async function handler() {
  const siteUrl = process.env.URL || process.env.DEPLOY_PRIME_URL;
  const cronSecret = process.env.CRON_SECRET;

  if (!siteUrl) {
    throw new Error("Missing Netlify site URL");
  }

  if (!cronSecret) {
    throw new Error("Missing CRON_SECRET");
  }

  const response = await fetch(`${siteUrl.replace(/\/$/, "")}/api/sync/heartbeat`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${cronSecret}`
    },
    cache: "no-store"
  });

  const text = await response.text();

  if (!response.ok) {
    throw new Error(`Heartbeat failed: ${response.status} ${text}`);
  }

  console.log(`Heartbeat synced: ${text}`);
}

export const config = {
  schedule: "*/30 * * * *"
};
