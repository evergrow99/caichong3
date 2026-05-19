import { createCaichongClient, type ExploreTask } from "@/lib/caichong";
import { getPlatformCaichongAccount } from "@/lib/caichong-account";
import { createSupabaseServiceClient, hasSupabaseServiceConfig } from "@/lib/supabase/server";

export type MarketActivityItem = {
  taskId: string;
  description: string;
  price: number;
  status: string;
  createdAt?: string;
};

export type MarketActivityCategory = "全部" | "文案" | "图片" | "声音" | "视频";

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
  activity_at: string;
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
  caichong_task_id: string;
  description: string;
  price: number | string;
  status: string;
  submission_count: number | null;
  created_at: string | null;
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
const TOPIC_RULES = [
  { label: "小红书文案", pattern: /小红书|种草|笔记|标题/ },
  { label: "视频脚本", pattern: /视频|脚本|短视频|vlog|分镜|剪辑/ },
  { label: "图文海报", pattern: /海报|图文|主图|封面|配图|图片/ },
  { label: "城市文旅", pattern: /文旅|旅游|城市|攻略|景区|出行/ },
  { label: "项目策划", pattern: /项目|策划|方案|计划|规划|提案|召集令|招募|运营/ },
  { label: "品牌推广", pattern: /推广|品牌|产品|营销|宣传|卖点/ },
  { label: "声音制作", pattern: /配音|音频|音乐|声音|歌曲|降噪/ }
];

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
  const text = description.toLowerCase();

  let copyScore = 0;
  let imageScore = 0;
  let audioScore = 0;
  let videoScore = 0;

  if (/文案|文章|脚本|总结|回复|攻略|标题|小红书|公众号|金句|口号|话术|卖点/.test(text)) copyScore += 4;
  if (/策划|方案|计划|规划|提案|运营|项目|召集令|招募|商业计划|bp|需求梳理/.test(text)) copyScore += 4;
  if (/音频|配音|声音|音乐|歌曲|降噪|录音|bgm|配乐/.test(text)) audioScore += 5;
  if (/视频|剪辑|字幕|vlog|数字人|短片|混剪|分镜|成片|片头|片尾/.test(text)) videoScore += 5;
  if (/图片|海报|头像|主图|修图|插画|封面|logo|标志|配图|banner|kv|长图|名片|包装|画面|出图/.test(text)) imageScore += 5;

  // “设计 / 品牌 / 视觉”经常出现在策划类需求里，不能单独强行判为图片。
  if (/设计|品牌|视觉|排版/.test(text)) imageScore += 1;
  if (/视频脚本|短视频脚本|分镜脚本/.test(text)) copyScore += 3;

  const scores = [
    ["文案", copyScore],
    ["声音", audioScore],
    ["视频", videoScore],
    ["图片", imageScore]
  ] as const;
  const [category, score] = scores.reduce((best, current) => (current[1] > best[1] ? current : best));

  if (score > 0) return category;
  return "文案";
}

function getMarketTaskTitle(description: string) {
  const normalized = getPublicMarketDescription(description).replace(/\s+/g, " ").trim();
  if (!normalized) return "新的创作需求";
  return normalized.length > 42 ? `${normalized.slice(0, 42)}...` : normalized;
}

function getMarketStatusLabel(status: string) {
  if (status === "COMPLETED" || status === "CLOSED") return "已完成";
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
    .filter((task) => task.taskId && task.description)
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
          deadlineAt: task.deadlineAt
        }
      };
    });
}

function mapLocalOrdersToRows(orders: LocalPublishedOrderRow[], nowIso: string): MarketObservedTaskUpsertRow[] {
  return orders
    .filter((order) => order.caichong_task_id && order.description)
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
          source: "local_published_order"
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

async function syncLocalPublishedOrders(nowIso: string) {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("orders")
    .select("caichong_task_id, description, price, status, submission_count, created_at")
    .neq("status", "PENDING_PAYMENT")
    .limit(5000);

  if (error) {
    if (isMissingTableError(error)) {
      return { ok: true as const, observedCount: 0 };
    }

    throw new Error(`读取本地发布订单失败：${error.message}`);
  }

  const rows = mapLocalOrdersToRows((data || []) as LocalPublishedOrderRow[], nowIso);
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
  const category = getMarketActivityCategory(description);

  return {
    taskId: task.task_id,
    title: getMarketTaskTitle(description),
    description,
    category,
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
      categories: MARKET_CATEGORIES.map((key) => ({ key, label: key, count: 0 })),
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
    .select("task_id, description, total_price, status, activity_at")
    .order("activity_at", { ascending: false })
    .limit(5000);

  if (error) {
    if (isMissingTableError(error)) {
      return {
        items: [],
        categories: MARKET_CATEGORIES.map((key) => ({ key, label: key, count: 0 })),
        topics: [],
        page,
        pageSize,
        total: 0,
        totalPages: 1
      };
    }

    throw new Error(`读取市场动态任务失败：${error.message}`);
  }

  const items = ((data || []) as MarketObservedTaskRow[]).map(mapObservedTaskToMarketItem);
  const categoryCounts = new Map<MarketActivityCategory, number>(MARKET_CATEGORIES.map((key) => [key, key === "全部" ? items.length : 0]));

  for (const item of items) {
    categoryCounts.set(item.category, (categoryCounts.get(item.category) || 0) + 1);
  }

  const filteredItems = category === "全部" ? items : items.filter((item) => item.category === category);
  const safePageSize = Math.min(48, Math.max(6, Number.isFinite(pageSize) ? pageSize : 18));
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / safePageSize));
  const safePage = Math.min(totalPages, Math.max(1, Number.isFinite(page) ? page : 1));
  const start = (safePage - 1) * safePageSize;
  const topics = TOPIC_RULES.map((topic) => ({
    label: topic.label,
    count: items.filter((item) => topic.pattern.test(item.description)).length
  }))
    .filter((topic) => topic.count > 0)
    .sort((left, right) => right.count - left.count)
    .slice(0, 6);

  return {
    items: filteredItems.slice(start, start + safePageSize),
    categories: MARKET_CATEGORIES.map((key) => ({
      key,
      label: key,
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

  const [todayRowsResult, monthRowsResult, totalCountResult, totalRowsResult, recentResult] = await Promise.all([
    supabase
      .from("market_observed_tasks")
      .select("total_price")
      .gte("activity_at", todayStart)
      .lt("activity_at", tomorrowStart)
      .limit(5000),
    supabase
      .from("market_observed_tasks")
      .select("total_price")
      .gte("activity_at", monthStart)
      .lt("activity_at", nextMonthStart)
      .limit(5000),
    supabase.from("market_observed_tasks").select("task_id", { count: "exact", head: true }),
    supabase.from("market_observed_tasks").select("total_price").limit(5000),
    supabase
      .from("market_observed_tasks")
      .select("task_id, description, total_price, status, activity_at")
      .order("activity_at", { ascending: false })
      .limit(5)
  ]);

  for (const result of [todayRowsResult, monthRowsResult, totalCountResult, totalRowsResult, recentResult]) {
    if (result.error) {
      if (isMissingTableError(result.error)) {
        return emptySummary();
      }

      throw new Error(`读取才虫市场活跃统计失败：${result.error.message}`);
    }
  }

  const recentOrders = ((recentResult.data || []) as MarketObservedTaskRow[]).map((task) => ({
    taskId: task.task_id,
    description: task.description,
    price: Number(task.total_price || task.price || 0),
    status: task.status,
    createdAt: task.activity_at
  }));

  return {
    todayOrderCount: todayRowsResult.data?.length || 0,
    monthOrderCount: baseline.monthTaskCountBase + (monthRowsResult.data?.length || 0),
    totalOrderCount: baseline.taskCountBase + (totalCountResult.count || 0),
    todayOrderAmount: sumRows((todayRowsResult.data || []) as { total_price: number | string }[]),
    monthOrderAmount: baseline.monthAmountBase + sumRows((monthRowsResult.data || []) as { total_price: number | string }[]),
    totalOrderAmount: baseline.amountBase + sumRows((totalRowsResult.data || []) as { total_price: number | string }[]),
    recentOrders,
    lastSyncedAt,
    source: "caichong_observed"
  };
}
