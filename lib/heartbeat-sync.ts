import { createCaichongClient } from "@/lib/caichong";
import type { AgentEvent, Submission } from "@/lib/caichong";
import { getPlatformCaichongAccount } from "@/lib/caichong-account";
import type { CurrentUser } from "@/lib/current-user";
import { getErrorMessage } from "@/lib/errors";
import { mockCaichong } from "@/lib/mock-caichong";
import {
  findByTaskId,
  findByUserAndTaskId,
  listByUser,
  listSyncableOrders,
  updateFromCaichongTask,
  updateOrderStatusByTaskId,
  upsertSubmission
} from "@/lib/order-repository";
import { getTaskService, isUsingMockCaichong } from "@/lib/task-service";
import { isSyncableTaskStatus } from "@/lib/task-rules";

type SyncResult = {
  ok: boolean;
  source: "mock" | "caichong";
  checkedEvents: number;
  ackedEventIds: number[];
  eventSyncError?: string;
  refreshErrorCount: number;
  messages: string[];
};

type TaskService = Awaited<ReturnType<typeof getTaskService>>;
type OrderLookup = (taskId: string) => ReturnType<typeof findByUserAndTaskId> | ReturnType<typeof findByTaskId>;

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function normalizeSubmissions(data: { submissions?: Submission[] } | Submission[]) {
  return Array.isArray(data) ? data : data.submissions || [];
}

function asString(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function createPlatformTaskService(): TaskService {
  const account = getPlatformCaichongAccount();

  if (isUsingMockCaichong(account.apiKey)) {
    return {
      account,
      source: "mock",
      service: mockCaichong
    };
  }

  return {
    account,
    source: "caichong",
    service: createCaichongClient({ apiKey: account.apiKey })
  };
}

async function handleEvent(event: AgentEvent, taskService: TaskService, findOrder: OrderLookup) {
  const messages: string[] = [];
  const taskId = event.taskId;

  if (!taskId) {
    return messages;
  }

  if (event.type === "TASK_ACTIVE") {
    await updateOrderStatusByTaskId(taskId, "ACTIVE", {
      deadlineAt: asString(event.payload?.deadline)
    });
    messages.push(`任务 ${taskId} 已支付并进入提交期`);
  }

  if (event.type === "TASK_SELECTION_WINDOW_STARTED") {
    await updateOrderStatusByTaskId(taskId, "PENDING_SELECTION", {
      deadlineAt: asString(event.payload?.selectionDeadline)
    });
    messages.push(`任务 ${taskId} 进入选择期`);
  }

  if (event.type === "TASK_CLOSED") {
    await updateOrderStatusByTaskId(taskId, "CLOSED", {
      closeReason: asString(event.payload?.message)
    });
    messages.push(`任务 ${taskId} 已关闭`);
  }

  if (event.type === "SUBMISSION_RECEIVED") {
    const order = await findOrder(taskId);
    const submissionData = await taskService.service.getSubmissions(taskId);
    const submissions = normalizeSubmissions(submissionData);

    if (order) {
      await Promise.all(
        submissions.map((submission) =>
          upsertSubmission({
            orderId: order.id,
            submission
          })
        )
      );
    }

    messages.push(`任务 ${taskId} 收到 ${submissions.length} 条投稿`);
  }

  return messages;
}

async function refreshOrders(orders: Awaited<ReturnType<typeof listByUser>>, taskService: TaskService) {
  const messages: string[] = [];
  let errorCount = 0;

  for (const order of orders) {
    if (taskService.source === "caichong" && !uuidPattern.test(order.caichongTaskId)) {
      continue;
    }

    try {
      const latestTask = await taskService.service.getTask(order.caichongTaskId);
      const syncedTask = (await updateFromCaichongTask(order.id, latestTask)) || latestTask;

      if ((syncedTask.submissionCount || 0) > 0) {
        try {
          const submissionData = await taskService.service.getSubmissions(order.caichongTaskId);
          const submissions = normalizeSubmissions(submissionData);

          await Promise.all(
            submissions.map((submission) =>
              upsertSubmission({
                orderId: order.id,
                submission
              })
            )
          );

          if (submissions.length > 0) {
            messages.push(`任务 ${order.caichongTaskId} 已同步 ${submissions.length} 条投稿`);
          }
        } catch (error) {
          errorCount += 1;
          messages.push(`任务 ${order.caichongTaskId} 投稿详情同步失败：${getErrorMessage(error)}`);
        }
      }

      if (syncedTask.status !== order.status) {
        messages.push(`任务 ${order.caichongTaskId} 状态已更新：${order.status} -> ${syncedTask.status}`);
      }
    } catch (error) {
      errorCount += 1;
      messages.push(`任务 ${order.caichongTaskId} 基础信息同步失败：${getErrorMessage(error)}`);
    }
  }

  return {
    messages,
    errorCount
  };
}

export async function syncHeartbeat(user: CurrentUser): Promise<SyncResult> {
  const taskService = await getTaskService(user);
  const ackedEventIds: number[] = [];
  const messages: string[] = [];
  let page = 1;
  let totalPages = 1;
  let checkedEvents = 0;
  let eventSyncError: string | undefined;
  let refreshErrorCount = 0;

  if (taskService.account.mode !== "PLATFORM_AGENT") {
    try {
      while (page <= totalPages) {
        const data = await taskService.service.listEvents({ page, pageSize: 50 });
        totalPages = data.totalPages || 1;
        checkedEvents += data.events.length;

        for (const event of data.events) {
          const eventMessages = await handleEvent(event, taskService, (taskId) => findByUserAndTaskId(user, taskId));
          messages.push(...eventMessages);
          ackedEventIds.push(event.id);
        }

        page += 1;
      }
    } catch (error) {
      eventSyncError = getErrorMessage(error);
      messages.push(`事件同步失败，已继续按订单刷新：${eventSyncError}`);
    }

    if (ackedEventIds.length > 0) {
      try {
        await taskService.service.ackEvents(ackedEventIds);
      } catch (error) {
        eventSyncError = getErrorMessage(error);
        messages.push(`事件确认失败，已继续按订单刷新：${eventSyncError}`);
      }
    }
  }

  if (taskService.source === "caichong") {
    const syncableOrders = (await listByUser(user)).filter((order) => isSyncableTaskStatus(order.status));
    const refreshed = await refreshOrders(syncableOrders, taskService);
    refreshErrorCount = refreshed.errorCount;
    messages.push(...refreshed.messages);
  }

  return {
    ok: !eventSyncError && refreshErrorCount === 0,
    source: taskService.source,
    checkedEvents,
    ackedEventIds,
    eventSyncError,
    refreshErrorCount,
    messages
  };
}

export async function syncPlatformHeartbeat(): Promise<SyncResult> {
  const taskService = createPlatformTaskService();
  const ackedEventIds: number[] = [];
  const messages: string[] = [];
  const syncableOrders = await listSyncableOrders();
  let page = 1;
  let totalPages = 1;
  let checkedEvents = 0;

  if (syncableOrders.length === 0) {
    return {
      ok: true,
      source: taskService.source,
      checkedEvents,
      ackedEventIds,
      refreshErrorCount: 0,
      messages: ["没有进行中的订单，本次自动同步已跳过"]
    };
  }

  let eventSyncError: string | undefined;
  try {
    while (page <= totalPages) {
      const data = await taskService.service.listEvents({ page, pageSize: 50 });
      totalPages = data.totalPages || 1;
      checkedEvents += data.events.length;

      for (const event of data.events) {
        const eventMessages = await handleEvent(event, taskService, findByTaskId);
        messages.push(...eventMessages);
        ackedEventIds.push(event.id);
      }

      page += 1;
    }
  } catch (error) {
    eventSyncError = getErrorMessage(error);
    messages.push(`事件同步失败，已继续按订单刷新：${eventSyncError}`);
  }

  if (ackedEventIds.length > 0) {
    try {
      await taskService.service.ackEvents(ackedEventIds);
    } catch (error) {
      eventSyncError = getErrorMessage(error);
      messages.push(`事件确认失败，已继续按订单刷新：${eventSyncError}`);
    }
  }

  let refreshErrorCount = 0;
  if (taskService.source === "caichong") {
    const refreshed = await refreshOrders(syncableOrders, taskService);
    refreshErrorCount = refreshed.errorCount;
    messages.push(...refreshed.messages);
  }

  return {
    ok: !eventSyncError && refreshErrorCount === 0,
    source: taskService.source,
    checkedEvents,
    ackedEventIds,
    eventSyncError,
    refreshErrorCount,
    messages
  };
}
