import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { findByUserAndTaskId, mapLocalOrderToTask } from "@/lib/order-repository";
import { getErrorMessage } from "@/lib/errors";

type RouteContext = {
  params: Promise<{ taskId: string }>;
};

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const user = await getCurrentUser();
    const { taskId } = await params;

    const localOrder = await findByUserAndTaskId(user, taskId);
    if (localOrder) {
      return NextResponse.json(mapLocalOrderToTask(localOrder));
    }

    return NextResponse.json({ error: "订单不存在，或你没有权限查看这条订单" }, { status: 404 });
  } catch (error) {
    const message = getErrorMessage(error, "读取订单详情失败");
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
