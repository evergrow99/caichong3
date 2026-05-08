import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { findByUserAndTaskId, findSubmissionByOrder, markSelectedSubmission } from "@/lib/order-repository";
import { getTaskService } from "@/lib/task-service";
import { getErrorMessage } from "@/lib/errors";
import { recordOperationLog } from "@/lib/operation-log";
import { canSelectSubmission } from "@/lib/task-rules";

type RouteContext = {
  params: Promise<{ taskId: string }>;
};

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const user = await getCurrentUser();
    const taskService = await getTaskService(user);
    const body = await request.json();
    const submissionId = String(body.submissionId || "").trim();

    if (!submissionId) {
      return NextResponse.json({ error: "缺少 submissionId" }, { status: 400 });
    }

    const { taskId } = await params;
    const localOrder = await findByUserAndTaskId(user, taskId);

    if (!localOrder) {
      return NextResponse.json({ error: "订单不存在，或你没有权限处理这条订单" }, { status: 404 });
    }

    if (!canSelectSubmission(localOrder)) {
      return NextResponse.json({ error: "当前阶段不能采用投稿，请先刷新订单状态后再试。" }, { status: 400 });
    }

    const localSubmission = await findSubmissionByOrder(localOrder.id, submissionId);
    if (!localSubmission) {
      return NextResponse.json({ error: "这个结果不存在，或不属于当前订单。请先刷新任务进展后再试。" }, { status: 404 });
    }

    const data = await taskService.service.selectSubmission(taskId, submissionId);
    await markSelectedSubmission(localOrder.id, submissionId);
    await recordOperationLog({
      userId: user.id,
      orderId: localOrder.id,
      caichongTaskId: taskId,
      scope: "task.select_submission",
      level: "info",
      message: "已采用结果并更新订单状态",
      details: {
        submissionId
      }
    });

    return NextResponse.json(data);
  } catch (error) {
    const message = getErrorMessage(error, "采用结果失败");
    const { taskId } = await params;
    await recordOperationLog({
      caichongTaskId: taskId,
      scope: "task.select_submission",
      level: "error",
      message,
      details: {
        route: "POST /api/tasks/[taskId]/select"
      }
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
