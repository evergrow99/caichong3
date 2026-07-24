import { after, NextResponse } from "next/server";
import { getErrorMessage } from "@/lib/errors";
import { syncPlatformHeartbeat } from "@/lib/heartbeat-sync";
import { syncOrderSmsReminders } from "@/lib/order-reminders";
import { recordOperationLog } from "@/lib/operation-log";

function getCronSecret(request: Request) {
  const authorization = request.headers.get("authorization");
  if (authorization?.startsWith("Bearer ")) {
    return authorization.slice("Bearer ".length);
  }

  return request.headers.get("x-cron-secret");
}

function authorizeCron(request: Request) {
  const allowedSecrets = [process.env.ORDER_REMINDER_CRON_SECRET, process.env.CRON_SECRET].filter(Boolean);

  if (allowedSecrets.length === 0) {
    return NextResponse.json({ error: "Missing ORDER_REMINDER_CRON_SECRET or CRON_SECRET" }, { status: 500 });
  }

  if (!allowedSecrets.includes(getCronSecret(request) || "")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return null;
}

async function syncPlatformHeartbeatAfterResponse() {
  try {
    const heartbeat = await syncPlatformHeartbeat();
    if (!heartbeat.ok) {
      await recordOperationLog({
        scope: "order.sms_reminder.heartbeat",
        level: "warn",
        message: "平台心跳部分失败，本地短信提醒已在响应前完成",
        details: {
          route: "GET /api/sync/order-reminders",
          eventSyncError: heartbeat.eventSyncError,
          refreshErrorCount: heartbeat.refreshErrorCount,
          messages: heartbeat.messages
        }
      });
    }
  } catch (error) {
    const message = getErrorMessage(error, "平台心跳同步失败");
    await recordOperationLog({
      scope: "order.sms_reminder.heartbeat",
      level: "error",
      message,
      details: {
        route: "GET /api/sync/order-reminders"
      }
    });
  }
}

export async function GET(request: Request) {
  const unauthorized = authorizeCron(request);
  if (unauthorized) return unauthorized;

  after(syncPlatformHeartbeatAfterResponse);

  try {
    const reminders = await syncOrderSmsReminders();

    return NextResponse.json({
      ok: reminders.ok,
      heartbeat: "scheduled",
      reminders
    });
  } catch (error) {
    const message = getErrorMessage(error, "同步订单短信提醒失败");
    await recordOperationLog({
      scope: "order.sms_reminder.sync",
      level: "error",
      message,
      details: {
        route: "GET /api/sync/order-reminders"
      }
    });
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
