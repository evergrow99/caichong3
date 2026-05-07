import type { Attachment, PublishTask, Submission } from "@/lib/caichong";
import type { CaichongAccount, PublishMode } from "@/lib/caichong-account";
import type { CurrentUser } from "@/lib/current-user";
import { createSupabaseServiceClient, hasSupabaseServiceConfig } from "@/lib/supabase/server";

export type LocalOrder = {
  id: string;
  userId: string;
  caichongAccountId: string | null;
  publishMode: PublishMode;
  caichongTaskId: string;
  description: string;
  price: number;
  status: string;
  paymentUrl?: string;
  deadlineAt?: string;
  closeReason?: string;
  submissionCount: number;
  selectedSubmissionId?: string;
  attachments: Attachment[];
};

export type AdminOrder = LocalOrder & {
  userPhone?: string;
  userDisplayName?: string;
  createdAt?: string;
  updatedAt?: string;
  isRealCaichongTask: boolean;
};

export type AdminOrderSummary = {
  totalOrders: number;
  legacyOrders: number;
  totalAmount: number;
  pendingPayment: number;
  active: number;
  pendingSelection: number;
  completed: number;
  closed: number;
};

export type CreateLocalOrderInput = {
  user: CurrentUser;
  account: CaichongAccount;
  task: PublishTask;
};

export type UpsertSubmissionInput = {
  orderId: string;
  submission: Submission;
};

export type OrderRepository = {
  createFromCaichongTask(input: CreateLocalOrderInput): Promise<LocalOrder>;
  listByUser(user: CurrentUser): Promise<LocalOrder[]>;
  findByUserAndTaskId(user: CurrentUser, taskId: string): Promise<LocalOrder | null>;
  findByTaskId(taskId: string): Promise<LocalOrder | null>;
  listSyncableOrders(): Promise<LocalOrder[]>;
  updateFromCaichongTask(orderId: string, task: PublishTask): Promise<LocalOrder>;
  upsertSubmission(input: UpsertSubmissionInput): Promise<void>;
};

export function mapTaskToLocalOrder(input: CreateLocalOrderInput): LocalOrder {
  return {
    id: input.task.taskId,
    userId: input.user.id,
    caichongAccountId: input.account.id,
    publishMode: input.account.mode,
    caichongTaskId: input.task.taskId,
    description: input.task.description,
    price: input.task.price,
    status: input.task.status,
    paymentUrl: input.task.paymentUrl,
    deadlineAt: input.task.deadlineAt,
    closeReason: input.task.closeReason,
    submissionCount: input.task.submissionCount || 0,
    attachments: input.task.attachments || []
  };
}

export function mapLocalOrderToTask(order: LocalOrder): PublishTask {
  return {
    taskId: order.caichongTaskId,
    description: order.description,
    price: order.price,
    status: order.status,
    paymentUrl: order.paymentUrl,
    deadlineAt: order.deadlineAt,
    attachments: order.attachments,
    submissionCount: order.submissionCount,
    closeReason: order.closeReason
  };
}

export function isOrderRepositoryEnabled() {
  return hasSupabaseServiceConfig();
}

type OrderRow = {
  id: string;
  user_id: string;
  caichong_account_id: string | null;
  publish_mode: PublishMode;
  caichong_task_id: string;
  description: string;
  price: number | string;
  status: string;
  payment_url: string | null;
  deadline_at: string | null;
  close_reason: string | null;
  submission_count: number | null;
  selected_submission_id: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  order_attachments?: {
    file_url: string;
    file_name: string | null;
    file_size: number | null;
    mime_type: string | null;
  }[];
};

type SubmissionRow = {
  id?: string;
  order_id?: string;
  caichong_submission_id: string;
  agent_id: string | null;
  agent_name: string | null;
  content: string;
  status: string | null;
  selected: boolean | null;
  created_at: string | null;
  submission_attachments?: {
    file_url: string;
    file_name: string | null;
    file_size: number | null;
    mime_type: string | null;
  }[];
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const orderSelect = `
  id,
  user_id,
  caichong_account_id,
  publish_mode,
  caichong_task_id,
  description,
  price,
  status,
  payment_url,
  deadline_at,
  close_reason,
  submission_count,
  selected_submission_id,
  order_attachments (
    file_url,
    file_name,
    file_size,
    mime_type
  )
`;

const adminOrderSelect = `
  ${orderSelect},
  created_at,
  updated_at
`;

function mapOrderRow(row: OrderRow): LocalOrder {
  return {
    id: row.id,
    userId: row.user_id,
    caichongAccountId: row.caichong_account_id,
    publishMode: row.publish_mode,
    caichongTaskId: row.caichong_task_id,
    description: row.description,
    price: Number(row.price),
    status: row.status,
    paymentUrl: row.payment_url || undefined,
    deadlineAt: row.deadline_at || undefined,
    closeReason: row.close_reason || undefined,
    submissionCount: row.submission_count || 0,
    selectedSubmissionId: row.selected_submission_id || undefined,
    attachments:
      row.order_attachments?.map((attachment) => ({
        fileUrl: attachment.file_url,
        fileName: attachment.file_name || undefined,
        fileSize: attachment.file_size || undefined,
        mimeType: attachment.mime_type || undefined
      })) || []
  };
}

function mapAdminOrderRow(row: OrderRow, profilesByUserId: Map<string, { phone: string | null; displayName: string | null }>): AdminOrder {
  const profile = profilesByUserId.get(row.user_id);
  return {
    ...mapOrderRow(row),
    userPhone: profile?.phone || undefined,
    userDisplayName: profile?.displayName || undefined,
    createdAt: row.created_at || undefined,
    updatedAt: row.updated_at || undefined,
    isRealCaichongTask: uuidPattern.test(row.caichong_task_id)
  };
}

function summarizeOrders(orders: AdminOrder[]): AdminOrderSummary {
  const realOrders = orders.filter((order) => order.isRealCaichongTask);
  return realOrders.reduce(
    (summary, order) => ({
      totalOrders: summary.totalOrders + 1,
      legacyOrders: orders.length - realOrders.length,
      totalAmount: summary.totalAmount + order.price,
      pendingPayment: summary.pendingPayment + (order.status === "PENDING_PAYMENT" ? 1 : 0),
      active: summary.active + (order.status === "ACTIVE" ? 1 : 0),
      pendingSelection: summary.pendingSelection + (order.status === "PENDING_SELECTION" ? 1 : 0),
      completed: summary.completed + (order.status === "COMPLETED" ? 1 : 0),
      closed: summary.closed + (order.status === "CLOSED" ? 1 : 0)
    }),
    {
      totalOrders: 0,
      legacyOrders: orders.length - realOrders.length,
      totalAmount: 0,
      pendingPayment: 0,
      active: 0,
      pendingSelection: 0,
      completed: 0,
      closed: 0
    }
  );
}

export async function listByUser(user: CurrentUser) {
  if (!isOrderRepositoryEnabled()) {
    return [];
  }

  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("orders")
    .select(orderSelect)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`读取本地订单失败：${error.message}`);
  }

  return (data || []).map((row) => mapOrderRow(row as OrderRow));
}

export async function findByUserAndTaskId(user: CurrentUser, taskId: string) {
  if (!isOrderRepositoryEnabled()) {
    return null;
  }

  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("orders")
    .select(orderSelect)
    .eq("user_id", user.id)
    .eq("caichong_task_id", taskId)
    .maybeSingle();

  if (error) {
    throw new Error(`读取本地订单详情失败：${error.message}`);
  }

  return data ? mapOrderRow(data as OrderRow) : null;
}

export async function findByTaskId(taskId: string) {
  if (!isOrderRepositoryEnabled()) {
    return null;
  }

  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase.from("orders").select(orderSelect).eq("caichong_task_id", taskId).maybeSingle();

  if (error) {
    throw new Error(`读取本地订单详情失败：${error.message}`);
  }

  return data ? mapOrderRow(data as OrderRow) : null;
}

export async function listSyncableOrders() {
  if (!isOrderRepositoryEnabled()) {
    return [];
  }

  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("orders")
    .select(orderSelect)
    .in("status", ["PENDING_PAYMENT", "ACTIVE", "PENDING_SELECTION"])
    .order("updated_at", { ascending: true })
    .limit(100);

  if (error) {
    throw new Error(`读取待同步订单失败：${error.message}`);
  }

  return (data || []).map((row) => mapOrderRow(row as OrderRow));
}

export async function listAdminOrders() {
  if (!isOrderRepositoryEnabled()) {
    return {
      orders: [],
      summary: summarizeOrders([])
    };
  }

  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("orders")
    .select(adminOrderSelect)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    throw new Error(`读取管理订单失败：${error.message}`);
  }

  const orderRows = (data || []) as OrderRow[];
  const userIds = Array.from(new Set(orderRows.map((row) => row.user_id)));
  const profilesByUserId = new Map<string, { phone: string | null; displayName: string | null }>();

  if (userIds.length > 0) {
    const { data: profiles, error: profilesError } = await supabase.from("profiles").select("id, phone, display_name").in("id", userIds);

    if (profilesError) {
      throw new Error(`读取管理用户失败：${profilesError.message}`);
    }

    for (const profile of profiles || []) {
      profilesByUserId.set(profile.id, {
        phone: profile.phone,
        displayName: profile.display_name
      });
    }
  }

  const orders = orderRows.map((row) => mapAdminOrderRow(row, profilesByUserId));

  return {
    orders,
    summary: summarizeOrders(orders)
  };
}

export async function updateFromCaichongTask(orderId: string, task: PublishTask) {
  if (!isOrderRepositoryEnabled()) {
    return null;
  }

  const supabase = createSupabaseServiceClient();
  const { error } = await supabase
    .from("orders")
    .update({
      status: task.status,
      payment_url: task.paymentUrl,
      close_reason: task.closeReason,
      submission_count: task.submissionCount || 0,
      updated_at: new Date().toISOString()
    })
    .eq("id", orderId);

  if (error) {
    throw new Error(`更新订单失败：${error.message}`);
  }

  return task;
}

export async function updateOrderPaymentUrl(orderId: string, paymentUrl: string) {
  if (!isOrderRepositoryEnabled()) {
    return;
  }

  const supabase = createSupabaseServiceClient();
  const { error } = await supabase
    .from("orders")
    .update({
      payment_url: paymentUrl,
      updated_at: new Date().toISOString()
    })
    .eq("id", orderId);

  if (error) {
    throw new Error(`保存付款入口失败：${error.message}`);
  }
}

export async function updateOrderStatusByTaskId(taskId: string, status: string, patch: Partial<Pick<PublishTask, "deadlineAt" | "closeReason">> = {}) {
  if (!isOrderRepositoryEnabled()) {
    return;
  }

  const supabase = createSupabaseServiceClient();
  const { error } = await supabase
    .from("orders")
    .update({
      status,
      deadline_at: patch.deadlineAt,
      close_reason: patch.closeReason,
      updated_at: new Date().toISOString()
    })
    .eq("caichong_task_id", taskId);

  if (error) {
    throw new Error(`更新订单状态失败：${error.message}`);
  }
}

export async function upsertSubmission(input: UpsertSubmissionInput) {
  if (!isOrderRepositoryEnabled()) {
    return;
  }

  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("submissions")
    .upsert(
    {
      order_id: input.orderId,
      caichong_submission_id: input.submission.submissionId,
      agent_id: input.submission.agentId,
      agent_name: input.submission.agentName,
      content: input.submission.content,
      status: input.submission.status,
      selected: input.submission.selected || false
    },
    {
      onConflict: "caichong_submission_id"
    }
    )
    .select("id")
    .single();

  if (error) {
    throw new Error(`保存投稿失败：${error.message}`);
  }

  if (data?.id && input.submission.attachments?.length) {
    await replaceSubmissionAttachments(data.id, input.submission.attachments);
  }
}

async function replaceSubmissionAttachments(submissionId: string, attachments: Attachment[]) {
  const supabase = createSupabaseServiceClient();
  const { error: deleteError } = await supabase.from("submission_attachments").delete().eq("submission_id", submissionId);

  if (deleteError) {
    if (deleteError.code === "42P01") {
      return;
    }

    throw new Error(`清理投稿附件失败：${deleteError.message}`);
  }

  const { error: insertError } = await supabase.from("submission_attachments").insert(
    attachments.map((attachment) => ({
      submission_id: submissionId,
      file_url: attachment.fileUrl,
      file_name: attachment.fileName,
      file_size: attachment.fileSize,
      mime_type: attachment.mimeType
    }))
  );

  if (insertError && insertError.code !== "42P01") {
    throw new Error(`保存投稿附件失败：${insertError.message}`);
  }
}

function mapSubmissionRow(row: SubmissionRow, selectedSubmissionId?: string): Submission {
  const isSelected = Boolean(row.selected || (selectedSubmissionId && row.caichong_submission_id === selectedSubmissionId));

  return {
    submissionId: row.caichong_submission_id,
    agentId: row.agent_id || undefined,
    agentName: row.agent_name || undefined,
    content: row.content,
    status: isSelected ? "approved" : row.status || undefined,
    selected: isSelected,
    createdAt: row.created_at || undefined,
    attachments:
      row.submission_attachments?.map((attachment) => ({
        fileUrl: attachment.file_url,
        fileName: attachment.file_name || undefined,
        fileSize: attachment.file_size || undefined,
        mimeType: attachment.mime_type || undefined
      })) || []
  };
}

export async function listSubmissionsByOrder(orderId: string, selectedSubmissionId?: string) {
  if (!isOrderRepositoryEnabled()) {
    return [];
  }

  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("submissions")
    .select(
      `
      id,
      caichong_submission_id,
      agent_id,
      agent_name,
      content,
      status,
      selected,
      created_at,
      submission_attachments (
        file_url,
        file_name,
        file_size,
        mime_type
      )
    `
    )
    .eq("order_id", orderId)
    .order("created_at", { ascending: false });

  if (error) {
    if (error.code === "PGRST200" || error.code === "42P01") {
      return listSubmissionsByOrderWithoutAttachments(orderId, selectedSubmissionId);
    }

    throw new Error(`读取本地投稿失败：${error.message}`);
  }

  return ((data || []) as SubmissionRow[]).map((row) => mapSubmissionRow(row, selectedSubmissionId));
}

async function listSubmissionsByOrderWithoutAttachments(orderId: string, selectedSubmissionId?: string) {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("submissions")
    .select("caichong_submission_id, agent_id, agent_name, content, status, selected, created_at")
    .eq("order_id", orderId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`读取本地投稿失败：${error.message}`);
  }

  return ((data || []) as SubmissionRow[]).map((row) => mapSubmissionRow(row, selectedSubmissionId));
}

export async function findSubmissionByOrder(orderId: string, submissionId: string) {
  if (!isOrderRepositoryEnabled()) {
    return null;
  }

  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("submissions")
    .select(
      `
      id,
      caichong_submission_id,
      agent_id,
      agent_name,
      content,
      status,
      selected,
      created_at,
      submission_attachments (
        file_url,
        file_name,
        file_size,
        mime_type
      )
    `
    )
    .eq("order_id", orderId)
    .eq("caichong_submission_id", submissionId)
    .maybeSingle();

  if (error) {
    if (error.code === "PGRST200" || error.code === "42P01") {
      return findSubmissionByOrderWithoutAttachments(orderId, submissionId);
    }

    throw new Error(`读取投稿详情失败：${error.message}`);
  }

  if (!data) {
    return null;
  }

  return mapSubmissionRow(data as SubmissionRow);
}

async function findSubmissionByOrderWithoutAttachments(orderId: string, submissionId: string) {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("submissions")
    .select("caichong_submission_id, agent_id, agent_name, content, status, selected, created_at")
    .eq("order_id", orderId)
    .eq("caichong_submission_id", submissionId)
    .maybeSingle();

  if (error) {
    throw new Error(`读取投稿详情失败：${error.message}`);
  }

  return data ? mapSubmissionRow(data as SubmissionRow) : null;
}

export async function markSelectedSubmission(orderId: string, submissionId: string) {
  if (!isOrderRepositoryEnabled()) {
    return;
  }

  const supabase = createSupabaseServiceClient();
  const { error: resetError } = await supabase
    .from("submissions")
    .update({
      selected: false,
      status: "rejected"
    })
    .eq("order_id", orderId);

  if (resetError) {
    throw new Error(`更新未选中投稿失败：${resetError.message}`);
  }

  const { error: selectError } = await supabase
    .from("submissions")
    .update({
      selected: true,
      status: "approved"
    })
    .eq("order_id", orderId)
    .eq("caichong_submission_id", submissionId);

  if (selectError) {
    throw new Error(`更新选中投稿失败：${selectError.message}`);
  }

  const { error: orderError } = await supabase
    .from("orders")
    .update({
      status: "COMPLETED",
      selected_submission_id: submissionId,
      updated_at: new Date().toISOString()
    })
    .eq("id", orderId);

  if (orderError) {
    throw new Error(`更新订单选中结果失败：${orderError.message}`);
  }
}

export async function createFromCaichongTask(input: CreateLocalOrderInput) {
  if (!isOrderRepositoryEnabled()) {
    return mapTaskToLocalOrder(input);
  }

  const supabase = createSupabaseServiceClient();
  const { error: accountError } = await supabase.from("caichong_accounts").upsert({
    id: input.account.id,
    owner_user_id: input.account.ownerUserId,
    mode: input.account.mode,
    label: input.account.label,
    encrypted_api_key: input.account.apiKey || "__mock__"
  });

  if (accountError) {
    throw new Error(`保存才虫账户失败：${accountError.message}`);
  }

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .upsert(
      {
        user_id: input.user.id,
        caichong_account_id: input.account.id,
        publish_mode: input.account.mode,
        caichong_task_id: input.task.taskId,
        description: input.task.description,
        price: input.task.price,
        status: input.task.status,
        payment_url: input.task.paymentUrl,
        close_reason: input.task.closeReason,
        submission_count: input.task.submissionCount || 0
      },
      {
        onConflict: "caichong_task_id"
      }
    )
    .select("id")
    .single();

  if (orderError) {
    throw new Error(`保存订单失败：${orderError.message}`);
  }

  if (input.task.attachments?.length) {
    const { error: attachmentError } = await supabase.from("order_attachments").insert(
      input.task.attachments.map((attachment) => ({
        order_id: order.id,
        file_url: attachment.fileUrl,
        file_name: attachment.fileName,
        file_size: attachment.fileSize,
        mime_type: attachment.mimeType
      }))
    );

    if (attachmentError) {
      throw new Error(`保存订单附件失败：${attachmentError.message}`);
    }
  }

  return mapTaskToLocalOrder(input);
}
