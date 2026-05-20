import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { getTaskService } from "@/lib/task-service";
import {
  createFromCaichongTask,
  isOrderRepositoryEnabled,
  listByUser,
  mapLocalOrderToTask,
  updateFromCaichongTask
} from "@/lib/order-repository";
import { recordOperationLog } from "@/lib/operation-log";
import { ensureUserProfile } from "@/lib/user-profile";
import { getErrorMessage } from "@/lib/errors";

function toErrorResponse(error: unknown, fallback: string) {
  const message = getErrorMessage(error, fallback);
  return NextResponse.json({ error: message }, { status: 500 });
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const refreshableStatuses = new Set(["PENDING_PAYMENT", "ACTIVE", "PENDING_SELECTION"]);
const MIN_DESCRIPTION_LENGTH = 10;

async function refreshUserOrders(localOrders: Awaited<ReturnType<typeof listByUser>>, taskService: Awaited<ReturnType<typeof getTaskService>>) {
  if (taskService.source !== "caichong") {
    return localOrders;
  }

  const refreshedOrders = [];
  for (const order of localOrders) {
    if (!refreshableStatuses.has(order.status) || !uuidPattern.test(order.caichongTaskId)) {
      refreshedOrders.push(order);
      continue;
    }

    try {
      const latestTask = await taskService.service.getTask(order.caichongTaskId);
      const syncedTask = (await updateFromCaichongTask(order.id, latestTask)) || latestTask;
      refreshedOrders.push({
        ...order,
        status: syncedTask.status || order.status,
        paymentUrl: syncedTask.paymentUrl || order.paymentUrl,
        deadlineAt: syncedTask.deadlineAt || order.deadlineAt,
        closeReason: syncedTask.closeReason,
        submissionCount: syncedTask.submissionCount || 0
      });
    } catch {
      refreshedOrders.push(order);
    }
  }

  return refreshedOrders;
}

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    await ensureUserProfile(user);
    const taskService = await getTaskService(user);
    const { searchParams } = new URL(request.url);
    const page = Number(searchParams.get("page") || 1);
    const pageSize = Number(searchParams.get("pageSize") || 20);

    const localOrders = await listByUser(user);
    if (isOrderRepositoryEnabled()) {
      const syncedOrders = await refreshUserOrders(localOrders, taskService);
      const start = (page - 1) * pageSize;
      const tasks = syncedOrders.slice(start, start + pageSize).map(mapLocalOrderToTask);

      return NextResponse.json({
        tasks,
        total: syncedOrders.length,
        page,
        pageSize,
        totalPages: Math.max(1, Math.ceil(syncedOrders.length / pageSize)),
        accountMode: taskService.account.mode,
        accountLabel: taskService.account.label,
        source: "supabase"
      });
    }

    const data = await taskService.service.listTasks({ page, pageSize });
    return NextResponse.json({
      ...data,
      accountMode: taskService.account.mode,
      accountLabel: taskService.account.label,
      source: taskService.source
    });
  } catch (error) {
    const message = getErrorMessage(error, "读取订单失败");
    await recordOperationLog({
      scope: "task.list",
      level: "error",
      message,
      details: {
        route: "GET /api/tasks"
      }
    });
    return toErrorResponse(error, "读取订单失败");
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (user.authMode !== "phone") {
      return NextResponse.json({ error: "请先用手机号登录后再发布订单" }, { status: 401 });
    }

    await ensureUserProfile(user);
    const taskService = await getTaskService(user);
    const body = await request.json();
    const description = String(body.description || "").trim();
    const price = Number(body.price);

    if (description.length < MIN_DESCRIPTION_LENGTH) {
      return NextResponse.json({ error: "请输入10个字以上的需求描述" }, { status: 400 });
    }

    if (!Number.isFinite(price) || price < 1 || price > 100) {
      return NextResponse.json({ error: "价格必须在 1 到 100 元之间" }, { status: 400 });
    }

    const data = await taskService.service.createTask({
      description,
      price,
      attachments: body.attachments || []
    });
    await createFromCaichongTask({
      user,
      account: taskService.account,
      task: data
    });

    return NextResponse.json({
      ...data,
      accountMode: taskService.account.mode,
      accountLabel: taskService.account.label
    });
  } catch (error) {
    const message = getErrorMessage(error, "发布订单失败");
    await recordOperationLog({
      scope: "task.create",
      level: "error",
      message,
      details: {
        route: "POST /api/tasks"
      }
    });
    return toErrorResponse(error, "发布订单失败");
  }
}
