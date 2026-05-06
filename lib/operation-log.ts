import { createSupabaseServiceClient, hasSupabaseServiceConfig } from "@/lib/supabase/server";

export type OperationLogLevel = "info" | "warn" | "error";

export type OperationLogInput = {
  userId?: string;
  orderId?: string;
  caichongTaskId?: string;
  scope: string;
  level: OperationLogLevel;
  message: string;
  details?: Record<string, unknown>;
};

export type OperationLog = {
  id: string;
  userId?: string;
  orderId?: string;
  caichongTaskId?: string;
  scope: string;
  level: OperationLogLevel;
  message: string;
  details?: Record<string, unknown>;
  resolvedAt?: string;
  createdAt: string;
};

type OperationLogRow = {
  id: string;
  user_id: string | null;
  order_id: string | null;
  caichong_task_id: string | null;
  scope: string;
  level: OperationLogLevel;
  message: string;
  details: Record<string, unknown> | null;
  resolved_at: string | null;
  created_at: string;
};

function mapOperationLog(row: OperationLogRow): OperationLog {
  return {
    id: row.id,
    userId: row.user_id || undefined,
    orderId: row.order_id || undefined,
    caichongTaskId: row.caichong_task_id || undefined,
    scope: row.scope,
    level: row.level,
    message: row.message,
    details: row.details || undefined,
    resolvedAt: row.resolved_at || undefined,
    createdAt: row.created_at
  };
}

export async function recordOperationLog(input: OperationLogInput) {
  if (!hasSupabaseServiceConfig()) {
    return;
  }

  try {
    const supabase = createSupabaseServiceClient();
    await supabase.from("operation_logs").insert({
      user_id: input.userId,
      order_id: input.orderId,
      caichong_task_id: input.caichongTaskId,
      scope: input.scope,
      level: input.level,
      message: input.message,
      details: input.details
    });
  } catch (error) {
    console.error("记录操作日志失败", error);
  }
}

export async function listOperationLogs(limit = 50) {
  if (!hasSupabaseServiceConfig()) {
    return [];
  }

  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("operation_logs")
    .select("id, user_id, order_id, caichong_task_id, scope, level, message, details, resolved_at, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    if (error.code === "42P01" || error.message.includes("operation_logs")) {
      return [];
    }

    throw new Error(`读取操作日志失败：${error.message}`);
  }

  return ((data || []) as OperationLogRow[]).map(mapOperationLog);
}
