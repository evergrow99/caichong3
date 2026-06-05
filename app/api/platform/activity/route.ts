import { NextResponse } from "next/server";
import { getErrorMessage } from "@/lib/errors";
import { getMarketActivitySummary, syncMarketActivityIfStale } from "@/lib/market-activity";
import { recordOperationLog } from "@/lib/operation-log";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    if (searchParams.get("sync") !== "0") {
      await syncMarketActivityIfStale();
    }

    const summary = await getMarketActivitySummary();
    return NextResponse.json(summary);
  } catch (error) {
    const message = getErrorMessage(error, "读取才虫市场活跃数据失败");
    await recordOperationLog({
      scope: "market.activity",
      level: "error",
      message,
      details: {
        route: "GET /api/platform/activity"
      }
    });

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
