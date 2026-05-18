import { OrderConsole } from "@/components/order-console";
import { getMarketActivitySummary, getMarketFeed, syncMarketActivityIfStale } from "@/lib/market-activity";

export const dynamic = "force-dynamic";

export default async function MarketPage() {
  await syncMarketActivityIfStale();
  const [summary, feed] = await Promise.all([getMarketActivitySummary(), getMarketFeed({ pageSize: 48 })]);

  return <OrderConsole marketPreview={{ summary, feed }} />;
}
