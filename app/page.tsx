import { OrderConsole } from "@/components/order-console";
import { getMarketActivitySummary, getMarketFeed } from "@/lib/market-activity";
import type { MarketActivityCategory, MarketActivitySummary, MarketFeedResponse } from "@/lib/market-activity";

export const dynamic = "force-dynamic";

const HOME_MARKET_PREVIEW_TIMEOUT_MS = 900;
const MARKET_CATEGORIES: MarketActivityCategory[] = ["全部", "文案", "图片", "声音", "视频"];
const emptyMarketSummary: MarketActivitySummary = {
  todayOrderCount: 0,
  monthOrderCount: 0,
  totalOrderCount: 0,
  todayOrderAmount: 0,
  monthOrderAmount: 0,
  totalOrderAmount: 0,
  recentOrders: [],
  source: "unavailable"
};
const emptyMarketFeed: MarketFeedResponse = {
  items: [],
  categories: MARKET_CATEGORIES.map((key) => ({
    key,
    label: key === "全部" ? "发现" : key,
    count: 0
  })),
  topics: [],
  page: 1,
  pageSize: 48,
  total: 0,
  totalPages: 1
};

async function getHomeMarketPreview() {
  const fallback = { summary: emptyMarketSummary, feed: emptyMarketFeed, isFeedPending: true, isSummaryPending: true };
  const preview = Promise.all([getMarketActivitySummary(), getMarketFeed({ pageSize: 48 })])
    .then(([summary, feed]) => {
      const isUnavailable = summary.source === "unavailable" && feed.total === 0 && feed.items.length === 0;
      return {
        summary,
        feed,
        isFeedPending: isUnavailable,
        isSummaryPending: isUnavailable
      };
    })
    .catch((error) => {
      console.error("首页市场预览读取失败", error);
      return fallback;
    });
  const timeout = new Promise<typeof fallback>((resolve) => {
    setTimeout(() => resolve(fallback), HOME_MARKET_PREVIEW_TIMEOUT_MS);
  });

  return Promise.race([preview, timeout]);
}

export default async function Home() {
  const marketPreview = await getHomeMarketPreview();

  return <OrderConsole marketPreview={marketPreview} />;
}
