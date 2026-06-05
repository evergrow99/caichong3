import { NextResponse } from "next/server";
import { getErrorMessage } from "@/lib/errors";
import { getMarketFeed, syncMarketActivityIfStale, type MarketActivityCategory } from "@/lib/market-activity";
import { recordOperationLog } from "@/lib/operation-log";

const allowedCategories: MarketActivityCategory[] = ["全部", "文案", "图片", "声音", "视频"];

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    if (searchParams.get("sync") !== "0") {
      await syncMarketActivityIfStale();
    }

    const categoryParam = searchParams.get("category") as MarketActivityCategory | null;
    const category = categoryParam && allowedCategories.includes(categoryParam) ? categoryParam : "全部";
    const page = Number(searchParams.get("page") || 1);
    const pageSize = Number(searchParams.get("pageSize") || 18);
    const feed = await getMarketFeed({ category, page, pageSize });

    return NextResponse.json(feed);
  } catch (error) {
    const message = getErrorMessage(error, "读取市场动态失败");
    await recordOperationLog({
      scope: "market.feed",
      level: "error",
      message,
      details: {
        route: "GET /api/platform/market"
      }
    });

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
