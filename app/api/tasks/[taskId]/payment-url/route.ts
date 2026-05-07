import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { findByUserAndTaskId, updateOrderPaymentUrl } from "@/lib/order-repository";
import { getTaskService } from "@/lib/task-service";
import { getErrorMessage } from "@/lib/errors";

type RouteContext = {
  params: Promise<{ taskId: string }>;
};

export async function POST(_request: Request, { params }: RouteContext) {
  try {
    const user = await getCurrentUser();
    const taskService = await getTaskService(user);
    const { taskId } = await params;
    const localOrder = await findByUserAndTaskId(user, taskId);

    if (!localOrder) {
      return NextResponse.json({ error: "订单不存在，或你没有权限刷新这条订单的付款入口" }, { status: 404 });
    }

    const data = await taskService.service.getPaymentUrl(taskId);
    if (data.paymentUrl) {
      await updateOrderPaymentUrl(localOrder.id, data.paymentUrl);
    }

    return NextResponse.json(data);
  } catch (error) {
    const message = getErrorMessage(error, "刷新付款入口失败");
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
