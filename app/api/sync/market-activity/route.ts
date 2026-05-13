import { NextResponse } from "next/server";
import { getErrorMessage } from "@/lib/errors";
import { syncMarketActivity } from "@/lib/market-activity";
import { recordOperationLog } from "@/lib/operation-log";

function getCronSecret(request: Request) {
  const authorization = request.headers.get("authorization");
  if (authorization?.startsWith("Bearer ")) {
    return authorization.slice("Bearer ".length);
  }

  return request.headers.get("x-cron-secret");
}

function authorizeCron(request: Request) {
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return NextResponse.json({ error: "Missing CRON_SECRET" }, { status: 500 });
  }

  if (getCronSecret(request) !== cronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return null;
}

export async function GET(request: Request) {
  const unauthorized = authorizeCron(request);
  if (unauthorized) return unauthorized;

  try {
    const result = await syncMarketActivity({ force: true });
    return NextResponse.json({
      ...result
    });
  } catch (error) {
    const message = getErrorMessage(error, "同步才虫市场活跃数据失败");
    await recordOperationLog({
      scope: "market.activity.sync",
      level: "error",
      message,
      details: {
        route: "GET /api/sync/market-activity"
      }
    });
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
