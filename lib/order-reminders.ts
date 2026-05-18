import { isAliyunOrderReminderSmsConfigured, sendAliyunTemplateSms } from "@/lib/aliyun-sms";
import { getErrorMessage } from "@/lib/errors";
import { recordOperationLog } from "@/lib/operation-log";
import { createSupabaseServiceClient, hasSupabaseServiceConfig } from "@/lib/supabase/server";
import { getDerivedTaskLifecycle } from "@/lib/task-rules";

type ReminderType = "SUBMISSION_RECEIVED" | "SELECTION_STARTED" | "SELECTION_DEADLINE_6H";
type ReminderStatus = "PENDING" | "SENT" | "FAILED" | "SKIPPED";

type OrderReminderSyncResult = {
  ok: boolean;
  skipped: boolean;
  checked: number;
  sent: number;
  failed: number;
  skippedExisting: number;
  messages: string[];
};

type ReminderOrderRow = {
  id: string;
  user_id: string;
  caichong_task_id: string;
  description: string;
  status: string;
  deadline_at: string | null;
  submission_count: number | null;
  created_at: string;
  updated_at: string | null;
};

type ReminderSubmissionRow = {
  id: string;
  order_id: string;
  caichong_submission_id: string;
  created_at: string;
};

type ReminderLogRow = {
  id: string;
  status: ReminderStatus;
  attempt_count: number | null;
  updated_at: string;
};

type CandidateReminder = {
  order: ReminderOrderRow;
  phone: string;
  reminderKey: string;
  reminderType: ReminderType;
  caichongSubmissionId?: string;
  deadlineAt?: string;
  templateCode: string;
  templateParams: Record<string, string>;
  messageText: string;
};

const SUBMISSION_LOOKBACK_HOURS = Math.max(1, Number(process.env.ORDER_REMINDER_SUBMISSION_LOOKBACK_HOURS || 48));
const PENDING_RETRY_AFTER_MINUTES = 15;

function getTemplateCode(type: ReminderType) {
  if (type === "SUBMISSION_RECEIVED") return process.env.ALIYUN_SMS_SUBMISSION_TEMPLATE_CODE || "";
  if (type === "SELECTION_STARTED") return process.env.ALIYUN_SMS_SELECTION_STARTED_TEMPLATE_CODE || "";
  return process.env.ALIYUN_SMS_SELECTION_DEADLINE_TEMPLATE_CODE || "";
}

function formatReminderDeadline(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const parts = new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).formatToParts(date);
  const month = parts.find((part) => part.type === "month")?.value || "";
  const day = parts.find((part) => part.type === "day")?.value || "";
  const hour = parts.find((part) => part.type === "hour")?.value || "";
  const minute = parts.find((part) => part.type === "minute")?.value || "";

  if (!month || !day || !hour || !minute) return "";
  return `${month}月${day}日 ${hour}:${minute}`;
}

function createEmptyResult(message: string): OrderReminderSyncResult {
  return {
    ok: true,
    skipped: true,
    checked: 0,
    sent: 0,
    failed: 0,
    skippedExisting: 0,
    messages: [message]
  };
}

function isRetryablePending(row: ReminderLogRow) {
  const updatedAt = new Date(row.updated_at).getTime();
  if (Number.isNaN(updatedAt)) return false;
  return Date.now() - updatedAt > PENDING_RETRY_AFTER_MINUTES * 60 * 1000;
}

function shouldSendSixHourReminder(order: ReminderOrderRow) {
  if (order.status !== "PENDING_SELECTION" || !order.deadline_at) return false;
  const deadline = new Date(order.deadline_at);
  if (Number.isNaN(deadline.getTime())) return false;

  const remainingMs = deadline.getTime() - Date.now();
  return remainingMs > 0 && remainingMs <= 6 * 60 * 60 * 1000;
}

async function listCandidateOrders() {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("orders")
    .select("id, user_id, caichong_task_id, description, status, deadline_at, submission_count, created_at, updated_at")
    .in("status", ["ACTIVE", "PENDING_SELECTION"])
    .order("updated_at", { ascending: false })
    .limit(500);

  if (error) {
    throw new Error(`读取待提醒订单失败：${error.message}`);
  }

  return ((data || []) as ReminderOrderRow[])
    .map((order) => {
      const lifecyclePatch = getDerivedTaskLifecycle({
        status: order.status,
        deadlineAt: order.deadline_at || undefined,
        submissionCount: order.submission_count || 0,
        closeReason: undefined
      });

      return {
        ...order,
        status: lifecyclePatch?.status || order.status,
        deadline_at: lifecyclePatch?.deadlineAt || order.deadline_at
      };
    })
    .filter((order) => order.status === "ACTIVE" || order.status === "PENDING_SELECTION");
}

async function listPhonesByUserId(userIds: string[]) {
  if (userIds.length === 0) return new Map<string, string>();

  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase.from("profiles").select("id, phone").in("id", userIds);

  if (error) {
    throw new Error(`读取提醒用户手机号失败：${error.message}`);
  }

  const phonesByUserId = new Map<string, string>();
  for (const profile of data || []) {
    if (profile.phone) {
      phonesByUserId.set(profile.id, profile.phone);
    }
  }

  return phonesByUserId;
}

async function listRecentSubmissions(orderIds: string[]) {
  if (orderIds.length === 0) return [];

  const since = new Date(Date.now() - SUBMISSION_LOOKBACK_HOURS * 60 * 60 * 1000).toISOString();
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("submissions")
    .select("id, order_id, caichong_submission_id, created_at")
    .in("order_id", orderIds)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(1000);

  if (error) {
    throw new Error(`读取待提醒投稿失败：${error.message}`);
  }

  return (data || []) as ReminderSubmissionRow[];
}

function buildCandidateReminders(
  orders: ReminderOrderRow[],
  phonesByUserId: Map<string, string>,
  submissions: ReminderSubmissionRow[]
) {
  const ordersById = new Map(orders.map((order) => [order.id, order]));
  const candidates: CandidateReminder[] = [];

  for (const submission of submissions) {
    const order = ordersById.get(submission.order_id);
    const phone = order ? phonesByUserId.get(order.user_id) : undefined;
    const templateCode = getTemplateCode("SUBMISSION_RECEIVED");
    if (!order || !phone || !templateCode) continue;

    candidates.push({
      order,
      phone,
      reminderKey: `${order.id}:SUBMISSION_RECEIVED:${submission.caichong_submission_id}`,
      reminderType: "SUBMISSION_RECEIVED",
      caichongSubmissionId: submission.caichong_submission_id,
      templateCode,
      templateParams: {},
      messageText: "你的任务有新投稿，请登录查看。"
    });
  }

  for (const order of orders) {
    if (order.status !== "PENDING_SELECTION") continue;

    const phone = phonesByUserId.get(order.user_id);
    const deadline = formatReminderDeadline(order.deadline_at);
    if (!phone || !deadline) continue;

    const shouldSendDeadlineReminder = shouldSendSixHourReminder(order);
    const selectionStartedTemplateCode = getTemplateCode("SELECTION_STARTED");
    if (selectionStartedTemplateCode && !shouldSendDeadlineReminder) {
      candidates.push({
        order,
        phone,
        reminderKey: `${order.id}:SELECTION_STARTED`,
        reminderType: "SELECTION_STARTED",
        deadlineAt: order.deadline_at || undefined,
        templateCode: selectionStartedTemplateCode,
        templateParams: { deadline },
        messageText: `你的任务已进入选择期，请在${deadline}前选择满意投稿。`
      });
    }

    const deadlineTemplateCode = getTemplateCode("SELECTION_DEADLINE_6H");
    if (deadlineTemplateCode && shouldSendDeadlineReminder) {
      candidates.push({
        order,
        phone,
        reminderKey: `${order.id}:SELECTION_DEADLINE_6H`,
        reminderType: "SELECTION_DEADLINE_6H",
        deadlineAt: order.deadline_at || undefined,
        templateCode: deadlineTemplateCode,
        templateParams: { deadline },
        messageText: `你的任务选择截止时间临近，请在${deadline}前处理，超时将自动关闭并退款。`
      });
    }
  }

  return candidates;
}

async function reserveReminder(candidate: CandidateReminder) {
  const supabase = createSupabaseServiceClient();
  const { data: existing, error: existingError } = await supabase
    .from("order_sms_reminders")
    .select("id, status, attempt_count, updated_at")
    .eq("reminder_key", candidate.reminderKey)
    .maybeSingle();

  if (existingError) {
    throw new Error(`读取短信提醒记录失败：${existingError.message}`);
  }

  const existingRow = existing as ReminderLogRow | null;
  if (existingRow?.status === "SENT" || (existingRow?.status === "PENDING" && !isRetryablePending(existingRow))) {
    return {
      id: existingRow.id,
      reserved: false
    };
  }

  const payload = {
    order_id: candidate.order.id,
    reminder_key: candidate.reminderKey,
    reminder_type: candidate.reminderType,
    caichong_submission_id: candidate.caichongSubmissionId,
    user_phone: candidate.phone,
    deadline_at: candidate.deadlineAt,
    template_code: candidate.templateCode,
    template_params: candidate.templateParams,
    message_text: candidate.messageText,
    status: "PENDING" as const,
    attempt_count: (existingRow?.attempt_count || 0) + 1,
    error_message: null,
    updated_at: new Date().toISOString()
  };

  if (existingRow) {
    const { error: updateError } = await supabase.from("order_sms_reminders").update(payload).eq("id", existingRow.id);
    if (updateError) {
      throw new Error(`更新短信提醒记录失败：${updateError.message}`);
    }

    return {
      id: existingRow.id,
      reserved: true
    };
  }

  const { data, error } = await supabase.from("order_sms_reminders").insert(payload).select("id").single();
  if (error) {
    if (error.code === "23505") {
      return {
        id: "",
        reserved: false
      };
    }

    throw new Error(`创建短信提醒记录失败：${error.message}`);
  }

  return {
    id: data.id as string,
    reserved: true
  };
}

async function markReminderSent(reminderId: string) {
  const supabase = createSupabaseServiceClient();
  const { error } = await supabase
    .from("order_sms_reminders")
    .update({
      status: "SENT",
      sent_at: new Date().toISOString(),
      error_message: null,
      updated_at: new Date().toISOString()
    })
    .eq("id", reminderId);

  if (error) {
    throw new Error(`更新短信发送成功状态失败：${error.message}`);
  }
}

async function markReminderFailed(reminderId: string, errorMessage: string) {
  const supabase = createSupabaseServiceClient();
  const { error } = await supabase
    .from("order_sms_reminders")
    .update({
      status: "FAILED",
      error_message: errorMessage,
      updated_at: new Date().toISOString()
    })
    .eq("id", reminderId);

  if (error) {
    throw new Error(`更新短信发送失败状态失败：${error.message}`);
  }
}

export async function syncOrderSmsReminders(): Promise<OrderReminderSyncResult> {
  if (!hasSupabaseServiceConfig()) {
    return createEmptyResult("缺少 Supabase 服务端配置，短信提醒已跳过");
  }

  if (!isAliyunOrderReminderSmsConfigured()) {
    return createEmptyResult("订单短信提醒模板未配置完整，短信提醒已跳过");
  }

  const messages: string[] = [];
  const orders = await listCandidateOrders();
  const phonesByUserId = await listPhonesByUserId(Array.from(new Set(orders.map((order) => order.user_id))));
  const submissions = await listRecentSubmissions(orders.map((order) => order.id));
  const candidates = buildCandidateReminders(orders, phonesByUserId, submissions);
  let sent = 0;
  let failed = 0;
  let skippedExisting = 0;

  for (const candidate of candidates) {
    const reservation = await reserveReminder(candidate);
    if (!reservation.reserved) {
      skippedExisting += 1;
      continue;
    }

    try {
      await sendAliyunTemplateSms(candidate.phone, candidate.templateCode, candidate.templateParams);
      await markReminderSent(reservation.id);
      sent += 1;
    } catch (error) {
      const message = getErrorMessage(error, "短信提醒发送失败");
      failed += 1;
      await markReminderFailed(reservation.id, message);
      await recordOperationLog({
        userId: candidate.order.user_id,
        orderId: candidate.order.id,
        caichongTaskId: candidate.order.caichong_task_id,
        scope: "order.sms_reminder",
        level: "error",
        message,
        details: {
          reminderType: candidate.reminderType,
          reminderKey: candidate.reminderKey
        }
      });
    }
  }

  messages.push(`检查 ${candidates.length} 条短信提醒，发送 ${sent} 条，失败 ${failed} 条，跳过重复 ${skippedExisting} 条`);

  return {
    ok: failed === 0,
    skipped: false,
    checked: candidates.length,
    sent,
    failed,
    skippedExisting,
    messages
  };
}
