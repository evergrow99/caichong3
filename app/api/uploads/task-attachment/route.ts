import { NextResponse } from "next/server";
import { uploadTaskAttachment } from "@/lib/caichong";
import { getCurrentUser } from "@/lib/current-user";
import { getErrorMessage } from "@/lib/errors";
import { recordOperationLog } from "@/lib/operation-log";
import { getTaskService } from "@/lib/task-service";

const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (user.authMode !== "phone") {
      return NextResponse.json({ error: "请先用手机号登录后再上传附件" }, { status: 401 });
    }

    const taskService = await getTaskService(user);
    if (taskService.source !== "caichong") {
      return NextResponse.json({ error: "当前仍是演示模式，附件不会用于真实任务" }, { status: 400 });
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "请选择要上传的文件" }, { status: 400 });
    }

    if (file.size <= 0) {
      return NextResponse.json({ error: "文件内容不能为空" }, { status: 400 });
    }

    if (file.size > MAX_ATTACHMENT_SIZE) {
      return NextResponse.json({ error: "单个附件不能超过 10MB" }, { status: 400 });
    }

    const attachment = await uploadTaskAttachment(file, {
      apiKey: taskService.account.apiKey
    });

    return NextResponse.json(attachment);
  } catch (error) {
    const message = getErrorMessage(error, "附件上传失败");
    await recordOperationLog({
      scope: "attachment.upload",
      level: "error",
      message,
      details: {
        route: "POST /api/uploads/task-attachment"
      }
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
