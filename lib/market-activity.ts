import { createCaichongClient, type ExploreTask } from "@/lib/caichong";
import { getPlatformCaichongAccount } from "@/lib/caichong-account";
import { classifyMarketTask, type MarketPrimaryCategory } from "@/lib/market-classification";
import { createSupabaseServiceClient, hasSupabaseServiceConfig } from "@/lib/supabase/server";

export type MarketActivityItem = {
  taskId: string;
  description: string;
  price: number;
  status: string;
  createdAt?: string;
};

export type MarketActivityCategory = "全部" | MarketPrimaryCategory;

export type MarketActivitySummary = {
  todayOrderCount: number;
  monthOrderCount: number;
  totalOrderCount: number;
  todayOrderAmount: number;
  monthOrderAmount: number;
  totalOrderAmount: number;
  recentOrders: MarketActivityItem[];
  lastSyncedAt?: string;
  source: "caichong_observed" | "unavailable";
};

export type MarketFeedItem = {
  taskId: string;
  title: string;
  description: string;
  category: Exclude<MarketActivityCategory, "全部">;
  categoryConfidence: number;
  topic?: string;
  status: string;
  statusLabel: string;
  createdAt?: string;
};

export type MarketFeedResponse = {
  items: MarketFeedItem[];
  categories: { key: MarketActivityCategory; label: string; count: number }[];
  topics: { label: string; count: number }[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type MarketActivitySyncResult = {
  ok: boolean;
  skipped: boolean;
  reason?: string;
  observedCount: number;
  lastSyncedAt?: string;
};

type MarketObservedTaskRow = {
  task_id: string;
  description: string;
  price: number | string;
  total_price: number | string;
  status: string;
  submission_count: number | null;
  activity_at: string;
  raw?: {
    closeReason?: string;
    paidAt?: string;
  } | null;
};

type MarketObservedTaskUpsertRow = {
  task_id: string;
  description: string;
  price: number;
  total_price: number;
  status: string;
  submission_count: number;
  caichong_created_at: string | null;
  activity_at: string;
  last_seen_at: string;
  raw: Record<string, unknown>;
};

type LocalPublishedOrderRow = {
  user_id: string;
  caichong_task_id: string;
  description: string;
  price: number | string;
  status: string;
  submission_count: number | null;
  created_at: string | null;
  close_reason: string | null;
};

type MarketProfileRow = {
  id: string;
  phone: string | null;
  display_name: string | null;
};

type MarketBaselineRow = {
  task_count_base: number | null;
  amount_base: number | string | null;
  month_task_count_base: number | null;
  month_amount_base: number | string | null;
  note: string | null;
};

type MarketStateRow = {
  last_synced_at: string | null;
};

const MARKET_STATE_ID = "default";
const MARKET_BASELINE_ID = "default";
const DEFAULT_SYNC_INTERVAL_MINUTES = 30;
const DEFAULT_MAX_MARKET_PAGES = 10;
const MARKET_CATEGORIES: MarketActivityCategory[] = ["全部", "文案", "图片", "声音", "视频"];
const MIN_PUBLIC_MARKET_DESCRIPTION_LENGTH = 10;
const PUBLISHED_MARKET_STATUSES = new Set(["ACTIVE", "PENDING_SELECTION", "COMPLETED", "CLOSED"]);
const INTERNAL_TEST_PHONES = new Set(["10000000000", "1111111111", "11111111111", "12222222222", "13700000000", "13800000000", "13900000000"]);
const INTERNAL_TEST_USER_IDS = new Set(["00000000-0000-4000-8000-000000000001"]);

function isMissingTableError(error: { code?: string; message?: string }) {
  return error.code === "42P01" || error.code === "PGRST205" || Boolean(error.message?.includes("Could not find the table"));
}

function getNumberEnv(name: string, fallback: number) {
  const value = process.env[name];
  if (!value) return fallback;

  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
}

function getNumberEnvWithLegacy(name: string, legacyName: string, fallback: number) {
  const value = process.env[name];
  if (value) {
    return getNumberEnv(name, fallback);
  }

  return getNumberEnv(legacyName, fallback);
}

function getMarketApiKey() {
  return process.env.CAICHONG_MARKET_API_KEY || getPlatformCaichongAccount().apiKey;
}

function getTaskAmount(task: ExploreTask) {
  return Number(task.totalPrice || task.price || 0);
}

function isPublicMarketDescription(description?: string | null) {
  const normalized = description?.trim();
  if (!normalized || normalized.length < MIN_PUBLIC_MARKET_DESCRIPTION_LENGTH) return false;
  if (/测试任务|测试接单|测试支付|支付流程|不用接单|真实接口|接口联调|联调使用|小额测试任务/.test(normalized)) return false;
  return true;
}

function isPublishedMarketStatus(status?: string | null) {
  return PUBLISHED_MARKET_STATUSES.has(String(status || "").toUpperCase());
}

function isPublicMarketTask({
  status,
  description,
  closeReason,
  paidAt,
  submissionCount = 0
}: {
  status?: string | null;
  description?: string | null;
  closeReason?: string | null;
  paidAt?: string | null;
  submissionCount?: number | null;
}) {
  if (!isPublishedMarketStatus(status) || !isPublicMarketDescription(description)) return false;
  if (String(status || "").toUpperCase() !== "CLOSED") return true;
  if (closeReason === "TIMEOUT_NO_PAYMENT") return false;
  if (closeReason === "TIMEOUT_NO_SUBMISSION" || closeReason === "TIMEOUT_NO_SELECTION") return true;
  return Boolean(paidAt) || Number(submissionCount || 0) > 0;
}

function isInternalTestProfile(profile: Pick<MarketProfileRow, "id" | "phone" | "display_name">) {
  return (
    INTERNAL_TEST_USER_IDS.has(profile.id) ||
    Boolean(profile.phone && INTERNAL_TEST_PHONES.has(profile.phone)) ||
    profile.display_name === "演示用户"
  );
}

export function getPublicMarketDescription(description: string) {
  return description
    .replace(/爱虫是一个caichong\.net的外挂平台，?/gi, "这是一个内容创作服务平台，")
    .replace(/^真实接口联调测试：?/, "")
    .replace(/^真实接口测试订单：?/, "测试任务：")
    .replace("这是平台联调使用的小额测试任务。", "这是一条小额测试任务。")
    .replace(/aichong\.top/gi, "平台入口")
    .replace(/caichong\.net/gi, "平台")
    .replace(/caichong/gi, "平台")
    .replace(/AICHONG/gi, "平台")
    .replace(/爱虫/g, "平台")
    .replace(/才虫/g, "平台")
    .replace(/agent/gi, "服务方")
    .replace(/龙虾/g, "高级工具")
    .replace(/外挂/g, "辅助")
    .trim();
}

export function getMarketActivityCategory(description: string): Exclude<MarketActivityCategory, "全部"> {
  return classifyMarketTask(description).category;
}

function getMarketTaskTitle(description: string) {
  const normalized = getPublicMarketDescription(description).replace(/\s+/g, " ").trim();
  if (!normalized) return "新的创作需求";
  return normalized.length > 42 ? `${normalized.slice(0, 42)}...` : normalized;
}

function getMarketStatusLabel(status: string) {
  if (status === "COMPLETED") return "已完成";
  if (status === "CLOSED") return "已完成";
  return "进行中";
}

function toIsoDate(value?: string) {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

function getChinaPeriodBounds(now = new Date()) {
  const chinaOffsetMs = 8 * 60 * 60 * 1000;
  const chinaNow = new Date(now.getTime() + chinaOffsetMs);
  const year = chinaNow.getUTCFullYear();
  const month = chinaNow.getUTCMonth();
  const date = chinaNow.getUTCDate();

  return {
    todayStart: new Date(Date.UTC(year, month, date) - chinaOffsetMs).toISOString(),
    tomorrowStart: new Date(Date.UTC(year, month, date + 1) - chinaOffsetMs).toISOString(),
    monthStart: new Date(Date.UTC(year, month, 1) - chinaOffsetMs).toISOString(),
    nextMonthStart: new Date(Date.UTC(year, month + 1, 1) - chinaOffsetMs).toISOString()
  };
}

function emptySummary(): MarketActivitySummary {
  return {
    todayOrderCount: 0,
    monthOrderCount: 0,
    totalOrderCount: 0,
    todayOrderAmount: 0,
    monthOrderAmount: 0,
    totalOrderAmount: 0,
    recentOrders: [],
    source: "unavailable"
  };
}

async function listCaichongMarketTasks() {
  const apiKey = getMarketApiKey();
  if (!apiKey) {
    return null;
  }

  const client = createCaichongClient({ apiKey });
  const pageSize = 50;
  const firstPage = await client.listExploreTasks({ page: 1, pageSize });
  const maxPages = Math.max(1, getNumberEnv("CAICHONG_MARKET_MAX_PAGES", DEFAULT_MAX_MARKET_PAGES));
  const totalPages = Math.min(firstPage.totalPages || 1, maxPages);
  const tasks = [...firstPage.tasks];

  if (totalPages > 1) {
    const restPages = await Promise.all(
      Array.from({ length: totalPages - 1 }, (_item, index) => client.listExploreTasks({ page: index + 2, pageSize }))
    );
    for (const page of restPages) {
      tasks.push(...page.tasks);
    }
  }

  return tasks;
}

function mapExploreTasksToRows(tasks: ExploreTask[], nowIso: string): MarketObservedTaskUpsertRow[] {
  return tasks
    .filter((task) =>
      task.taskId && isPublicMarketTask({
        status: task.status,
        description: task.description,
        closeReason: task.closeReason,
        paidAt: task.paidAt,
        submissionCount: task.submissionCount
      })
    )
    .map((task) => {
      const caichongCreatedAt = toIsoDate(task.createdAt);
      const activityAt = caichongCreatedAt || nowIso;
      const totalPrice = getTaskAmount(task);

      return {
        task_id: task.taskId,
        description: task.description,
        price: Number(task.price || 0),
        total_price: totalPrice,
        status: task.status || "ACTIVE",
        submission_count: task.submissionCount || 0,
        caichong_created_at: caichongCreatedAt,
        activity_at: activityAt,
        last_seen_at: nowIso,
        raw: {
          source: "caichong_market",
          bonusCount: task.bonusCount || 0,
          bonusTotal: task.bonusTotal || 0,
          deadlineAt: task.deadlineAt,
          closeReason: task.closeReason,
          paidAt: task.paidAt
        }
      };
    });
}

function mapLocalOrdersToRows(orders: LocalPublishedOrderRow[], nowIso: string): MarketObservedTaskUpsertRow[] {
  return orders
    .filter((order) =>
      order.caichong_task_id && isPublicMarketTask({
        status: order.status,
        description: order.description,
        closeReason: order.close_reason,
        submissionCount: order.submission_count
      })
    )
    .map((order) => {
      const caichongCreatedAt = toIsoDate(order.created_at || undefined);
      const activityAt = caichongCreatedAt || nowIso;
      const price = Number(order.price || 0);

      return {
        task_id: order.caichong_task_id,
        description: order.description,
        price,
        total_price: price,
        status: order.status || "ACTIVE",
        submission_count: order.submission_count || 0,
        caichong_created_at: caichongCreatedAt,
        activity_at: activityAt,
        last_seen_at: nowIso,
        raw: {
          source: "local_published_order",
          closeReason: order.close_reason
        }
      };
    });
}

async function upsertObservedRows(rows: MarketObservedTaskUpsertRow[]) {
  if (rows.length === 0) {
    return { ok: true as const };
  }

  const supabase = createSupabaseServiceClient();
  const { error } = await supabase.from("market_observed_tasks").upsert(rows, {
    onConflict: "task_id"
  });

  if (error) {
    if (isMissingTableError(error)) {
      return { ok: false as const, reason: "migration_missing" };
    }

    throw new Error(`保存才虫市场观测任务失败：${error.message}`);
  }

  return { ok: true as const };
}

async function listInternalTestUserIds(userIds: string[]) {
  const internalUserIds = new Set(userIds.filter((userId) => INTERNAL_TEST_USER_IDS.has(userId)));
  if (userIds.length === 0) return internalUserIds;

  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase.from("profiles").select("id, phone, display_name").in("id", userIds);

  if (error) {
    if (isMissingTableError(error)) {
      return internalUserIds;
    }

    throw new Error(`读取本地测试用户失败：${error.message}`);
  }

  for (const profile of (data || []) as MarketProfileRow[]) {
    if (isInternalTestProfile(profile)) {
      internalUserIds.add(profile.id);
    }
  }

  return internalUserIds;
}

async function syncLocalPublishedOrders(nowIso: string) {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("orders")
    .select("user_id, caichong_task_id, description, price, status, submission_count, created_at, close_reason")
    .in("status", Array.from(PUBLISHED_MARKET_STATUSES))
    .limit(5000);

  if (error) {
    if (isMissingTableError(error)) {
      return { ok: true as const, observedCount: 0 };
    }

    throw new Error(`读取本地发布订单失败：${error.message}`);
  }

  const orders = (data || []) as LocalPublishedOrderRow[];
  const internalUserIds = await listInternalTestUserIds(Array.from(new Set(orders.map((order) => order.user_id).filter(Boolean))));
  const rows = mapLocalOrdersToRows(orders.filter((order) => !internalUserIds.has(order.user_id)), nowIso);
  const upsertResult = await upsertObservedRows(rows);

  if (!upsertResult.ok) {
    return {
      ok: false as const,
      reason: upsertResult.reason,
      observedCount: 0
    };
  }

  return {
    ok: true as const,
    observedCount: rows.length
  };
}

async function getLastSyncedAt() {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("market_activity_state")
    .select("last_synced_at")
    .eq("id", MARKET_STATE_ID)
    .maybeSingle();

  if (error) {
    if (isMissingTableError(error)) {
      return undefined;
    }

    throw new Error(`读取才虫市场同步状态失败：${error.message}`);
  }

  return (data as MarketStateRow | null)?.last_synced_at || undefined;
}

export async function syncMarketActivity({ force = false }: { force?: boolean } = {}): Promise<MarketActivitySyncResult> {
  if (!hasSupabaseServiceConfig()) {
    return {
      ok: false,
      skipped: true,
      reason: "supabase_unavailable",
      observedCount: 0
    };
  }

  const lastSyncedAt = await getLastSyncedAt();
  const syncIntervalMinutes = Math.max(1, getNumberEnv("CAICHONG_MARKET_SYNC_INTERVAL_MINUTES", DEFAULT_SYNC_INTERVAL_MINUTES));
  const nowIso = new Date().toISOString();
  const localSyncResult = await syncLocalPublishedOrders(nowIso);

  if (!localSyncResult.ok) {
    return {
      ok: false,
      skipped: true,
      reason: localSyncResult.reason,
      observedCount: 0,
      lastSyncedAt
    };
  }

  if (!force && lastSyncedAt) {
    const elapsedMs = Date.now() - new Date(lastSyncedAt).getTime();
    if (!Number.isNaN(elapsedMs) && elapsedMs < syncIntervalMinutes * 60 * 1000) {
      return {
        ok: true,
        skipped: true,
        reason: "fresh",
        observedCount: localSyncResult.observedCount,
        lastSyncedAt
      };
    }
  }

  const tasks = await listCaichongMarketTasks();
  if (!tasks) {
    return {
      ok: true,
      skipped: true,
      reason: "missing_caichong_api_key",
      observedCount: localSyncResult.observedCount,
      lastSyncedAt
    };
  }

  const rows = mapExploreTasksToRows(tasks, nowIso);
  const upsertResult = await upsertObservedRows(rows);

  if (!upsertResult.ok) {
    return {
      ok: false,
      skipped: true,
      reason: upsertResult.reason,
      observedCount: 0,
      lastSyncedAt
    };
  }

  const supabase = createSupabaseServiceClient();
  const { error: stateError } = await supabase.from("market_activity_state").upsert(
    {
      id: MARKET_STATE_ID,
      last_synced_at: nowIso,
      last_observed_count: rows.length + localSyncResult.observedCount,
      updated_at: nowIso
    },
    {
      onConflict: "id"
    }
  );

  if (stateError) {
    if (isMissingTableError(stateError)) {
      return {
        ok: false,
        skipped: true,
        reason: "migration_missing",
        observedCount: 0,
        lastSyncedAt
      };
    }

    throw new Error(`保存才虫市场同步状态失败：${stateError.message}`);
  }

  return {
    ok: true,
    skipped: false,
    observedCount: rows.length + localSyncResult.observedCount,
    lastSyncedAt: nowIso
  };
}

export async function syncMarketActivityIfStale() {
  return syncMarketActivity({ force: false });
}

async function getBaseline() {
  const fallback = {
    taskCountBase: getNumberEnvWithLegacy(
      "CAICHONG_MARKET_DISPLAY_BASELINE_TASK_COUNT",
      "CAICHONG_MARKET_BASELINE_TASK_COUNT",
      0
    ),
    amountBase: getNumberEnvWithLegacy("CAICHONG_MARKET_DISPLAY_BASELINE_AMOUNT", "CAICHONG_MARKET_BASELINE_AMOUNT", 0),
    monthTaskCountBase: getNumberEnv("CAICHONG_MARKET_DISPLAY_MONTH_BASELINE_TASK_COUNT", 0),
    monthAmountBase: getNumberEnv("CAICHONG_MARKET_DISPLAY_MONTH_BASELINE_AMOUNT", 0)
  };

  function parseNoteBaseline(note?: string | null) {
    if (!note) {
      return {};
    }

    try {
      const data = JSON.parse(note) as {
        monthTaskCountBase?: unknown;
        monthAmountBase?: unknown;
      };

      return {
        monthTaskCountBase: Number(data.monthTaskCountBase ?? fallback.monthTaskCountBase),
        monthAmountBase: Number(data.monthAmountBase ?? fallback.monthAmountBase)
      };
    } catch {
      return {};
    }
  }

  if (!hasSupabaseServiceConfig()) {
    return fallback;
  }

  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("market_activity_baselines")
    .select("task_count_base, amount_base, month_task_count_base, month_amount_base, note")
    .eq("id", MARKET_BASELINE_ID)
    .maybeSingle();

  if (error) {
    if (isMissingTableError(error)) {
      return fallback;
    }

    if (error.code === "42703" || Boolean(error.message?.includes("month_task_count_base"))) {
      const { data: legacyData, error: legacyError } = await supabase
        .from("market_activity_baselines")
        .select("task_count_base, amount_base, note")
        .eq("id", MARKET_BASELINE_ID)
        .maybeSingle();

      if (legacyError) {
        if (isMissingTableError(legacyError)) {
          return fallback;
        }

        throw new Error(`读取才虫市场基数失败：${legacyError.message}`);
      }

      const legacyBaseline = legacyData as Pick<MarketBaselineRow, "task_count_base" | "amount_base" | "note"> | null;
      const noteBaseline = parseNoteBaseline(legacyBaseline?.note);
      return {
        ...fallback,
        taskCountBase: Number(legacyBaseline?.task_count_base ?? fallback.taskCountBase),
        amountBase: Number(legacyBaseline?.amount_base ?? fallback.amountBase),
        ...noteBaseline
      };
    }

    throw new Error(`读取才虫市场基数失败：${error.message}`);
  }

  const baseline = data as MarketBaselineRow | null;
  const noteBaseline = parseNoteBaseline(baseline?.note);
  return {
    taskCountBase: Number(baseline?.task_count_base ?? fallback.taskCountBase),
    amountBase: Number(baseline?.amount_base ?? fallback.amountBase),
    monthTaskCountBase: Number(baseline?.month_task_count_base ?? noteBaseline.monthTaskCountBase ?? fallback.monthTaskCountBase),
    monthAmountBase: Number(baseline?.month_amount_base ?? noteBaseline.monthAmountBase ?? fallback.monthAmountBase)
  };
}

function sumRows(rows: { total_price: number | string }[]) {
  return rows.reduce((total, row) => total + Number(row.total_price || 0), 0);
}

function mapObservedTaskToMarketItem(task: MarketObservedTaskRow): MarketFeedItem {
  const description = getPublicMarketDescription(task.description);
  const classification = classifyMarketTask(description);

  return {
    taskId: task.task_id,
    title: getMarketTaskTitle(description),
    description,
    category: classification.category,
    categoryConfidence: classification.confidence,
    topic: classification.topic,
    status: task.status,
    statusLabel: getMarketStatusLabel(task.status),
    createdAt: task.activity_at
  };
}

export async function getMarketFeed({
  category = "全部",
  page = 1,
  pageSize = 18
}: {
  category?: MarketActivityCategory;
  page?: number;
  pageSize?: number;
} = {}): Promise<MarketFeedResponse> {
  if (!hasSupabaseServiceConfig()) {
    return {
      items: [],
      categories: MARKET_CATEGORIES.map((key) => ({ key, label: key === "全部" ? "发现" : key, count: 0 })),
      topics: [],
      page,
      pageSize,
      total: 0,
      totalPages: 1
    };
  }

  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("market_observed_tasks")
    .select("task_id, description, total_price, status, submission_count, activity_at, raw")
    .order("activity_at", { ascending: false })
    .limit(5000);

  if (error) {
    if (isMissingTableError(error)) {
      return {
        items: [],
        categories: MARKET_CATEGORIES.map((key) => ({ key, label: key === "全部" ? "发现" : key, count: 0 })),
        topics: [],
        page,
        pageSize,
        total: 0,
        totalPages: 1
      };
    }

    throw new Error(`读取市场动态任务失败：${error.message}`);
  }

  const items = ((data || []) as MarketObservedTaskRow[])
    .filter((task) =>
      isPublicMarketTask({
        status: task.status,
        description: task.description,
        closeReason: task.raw?.closeReason,
        paidAt: task.raw?.paidAt,
        submissionCount: task.submission_count
      })
    )
    .map(mapObservedTaskToMarketItem);
  const categoryCounts = new Map<MarketActivityCategory, number>(MARKET_CATEGORIES.map((key) => [key, key === "全部" ? items.length : 0]));

  for (const item of items) {
    categoryCounts.set(item.category, (categoryCounts.get(item.category) || 0) + 1);
  }

  const filteredItems = category === "全部" ? items : items.filter((item) => item.category === category);
  const safePageSize = Math.min(48, Math.max(1, Number.isFinite(pageSize) ? pageSize : 18));
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / safePageSize));
  const safePage = Math.min(totalPages, Math.max(1, Number.isFinite(page) ? page : 1));
  const start = (safePage - 1) * safePageSize;
  const topicCounts = new Map<string, number>();
  for (const item of items) {
    if (item.topic) {
      topicCounts.set(item.topic, (topicCounts.get(item.topic) || 0) + 1);
    }
  }
  const topics = Array.from(topicCounts.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((left, right) => right.count - left.count)
    .slice(0, 6);

  return {
    items: filteredItems.slice(start, start + safePageSize),
    categories: MARKET_CATEGORIES.map((key) => ({
      key,
      label: key === "全部" ? "发现" : key,
      count: categoryCounts.get(key) || 0
    })),
    topics,
    page: safePage,
    pageSize: safePageSize,
    total: filteredItems.length,
    totalPages
  };
}

export async function getMarketActivitySummary(): Promise<MarketActivitySummary> {
  if (!hasSupabaseServiceConfig()) {
    return emptySummary();
  }

  const supabase = createSupabaseServiceClient();
  const { todayStart, tomorrowStart, monthStart, nextMonthStart } = getChinaPeriodBounds();
  const baseline = await getBaseline();
  const lastSyncedAt = await getLastSyncedAt();

  const [todayRowsResult, monthRowsResult, totalRowsResult, recentResult] = await Promise.all([
    supabase
      .from("market_observed_tasks")
      .select("description, total_price, status, submission_count, raw")
      .gte("activity_at", todayStart)
      .lt("activity_at", tomorrowStart)
      .limit(5000),
    supabase
      .from("market_observed_tasks")
      .select("description, total_price, status, submission_count, raw")
      .gte("activity_at", monthStart)
      .lt("activity_at", nextMonthStart)
      .limit(5000),
    supabase.from("market_observed_tasks").select("description, total_price, status, submission_count, raw").limit(5000),
    supabase
      .from("market_observed_tasks")
      .select("task_id, description, total_price, status, submission_count, activity_at, raw")
      .order("activity_at", { ascending: false })
      .limit(20)
  ]);

  for (const result of [todayRowsResult, monthRowsResult, totalRowsResult, recentResult]) {
    if (result.error) {
      if (isMissingTableError(result.error)) {
        return emptySummary();
      }

      throw new Error(`读取才虫市场活跃统计失败：${result.error.message}`);
    }
  }

  const todayRows = ((todayRowsResult.data || []) as MarketObservedTaskRow[]).filter((row) =>
    isPublicMarketTask({
      status: row.status,
      description: row.description,
      closeReason: row.raw?.closeReason,
      paidAt: row.raw?.paidAt,
      submissionCount: row.submission_count
    })
  );
  const monthRows = ((monthRowsResult.data || []) as MarketObservedTaskRow[]).filter((row) =>
    isPublicMarketTask({
      status: row.status,
      description: row.description,
      closeReason: row.raw?.closeReason,
      paidAt: row.raw?.paidAt,
      submissionCount: row.submission_count
    })
  );
  const totalRows = ((totalRowsResult.data || []) as MarketObservedTaskRow[]).filter((row) =>
    isPublicMarketTask({
      status: row.status,
      description: row.description,
      closeReason: row.raw?.closeReason,
      paidAt: row.raw?.paidAt,
      submissionCount: row.submission_count
    })
  );
  const recentOrders = ((recentResult.data || []) as MarketObservedTaskRow[])
    .filter((task) =>
      isPublicMarketTask({
        status: task.status,
        description: task.description,
        closeReason: task.raw?.closeReason,
        paidAt: task.raw?.paidAt,
        submissionCount: task.submission_count
      })
    )
    .map((task) => ({
    taskId: task.task_id,
    description: task.description,
    price: Number(task.total_price || task.price || 0),
    status: task.status,
    createdAt: task.activity_at
  })).slice(0, 5);

  return {
    todayOrderCount: todayRows.length,
    monthOrderCount: baseline.monthTaskCountBase + monthRows.length,
    totalOrderCount: baseline.taskCountBase + totalRows.length,
    todayOrderAmount: sumRows(todayRows),
    monthOrderAmount: baseline.monthAmountBase + sumRows(monthRows),
    totalOrderAmount: baseline.amountBase + sumRows(totalRows),
    recentOrders,
    lastSyncedAt,
    source: "caichong_observed"
  };
}
