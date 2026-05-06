import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { getTaskService } from "@/lib/task-service";
import { createFromCaichongTask, isOrderRepositoryEnabled, listByUser, mapLocalOrderToTask } from "@/lib/order-repository";
import { recordOperationLog } from "@/lib/operation-log";
import { ensureUserProfile } from "@/lib/user-profile";
import { getErrorMessage } from "@/lib/errors";

function toErrorResponse(error: unknown, fallback: string) {
  const message = getErrorMessage(error, fallback);
  return NextResponse.json({ error: message }, { status: 500 });
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
      const start = (page - 1) * pageSize;
      const tasks = localOrders.slice(start, start + pageSize).map(mapLocalOrderToTask);

      return NextResponse.json({
        tasks,
        total: localOrders.length,
        page,
        pageSize,
        totalPages: Math.max(1, Math.ceil(localOrders.length / pageSize)),
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

    if (!description) {
      return NextResponse.json({ error: "任务说明不能为空" }, { status: 400 });
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
