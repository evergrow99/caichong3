import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { findByUserAndTaskId, mapLocalOrderToTask, updateFromCaichongTask } from "@/lib/order-repository";
import { getErrorMessage } from "@/lib/errors";
import { getTaskService } from "@/lib/task-service";

type RouteContext = {
  params: Promise<{ taskId: string }>;
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const user = await getCurrentUser();
    const { taskId } = await params;

    const localOrder = await findByUserAndTaskId(user, taskId);
    if (localOrder) {
      const localTask = mapLocalOrderToTask(localOrder);

      if (uuidPattern.test(taskId)) {
        try {
          const taskService = await getTaskService(user);
          const remoteTask = await taskService.service.getTask(taskId);
          try {
            await updateFromCaichongTask(localOrder.id, remoteTask);
          } catch {
            // Keep the detail page useful even when the local cache update is temporarily unavailable.
          }

          return NextResponse.json({
            ...localTask,
            ...remoteTask,
            description: localTask.description,
            paymentUrl: localTask.paymentUrl || remoteTask.paymentUrl
          });
        } catch {
          return NextResponse.json(localTask);
        }
      }

      return NextResponse.json(localTask);
    }

    return NextResponse.json({ error: "订单不存在，或你没有权限查看这条订单" }, { status: 404 });
  } catch (error) {
    const message = getErrorMessage(error, "读取订单详情失败");
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
