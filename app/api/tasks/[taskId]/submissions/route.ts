import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { listSubmissionsByUserAndTaskId, upsertSubmission } from "@/lib/order-repository";
import { getErrorMessage } from "@/lib/errors";
import { getTaskService } from "@/lib/task-service";
import type { Submission } from "@/lib/caichong";

type RouteContext = {
  params: Promise<{ taskId: string }>;
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SUBMISSION_REMOTE_REFRESH_TIMEOUT_MS = 4500;

function normalizeSubmissions(data: { submissions?: Submission[] } | Submission[]) {
  return Array.isArray(data) ? data : data.submissions || [];
}

export async function GET(request: Request, { params }: RouteContext) {
  try {
    const user = await getCurrentUser();
    const { taskId } = await params;
    const { searchParams } = new URL(request.url);
    const shouldRefresh = searchParams.get("refresh") === "1";
    const includeAttachments = searchParams.get("includeAttachments") === "1";

    const localBundle = await listSubmissionsByUserAndTaskId(user, taskId, { includeAttachments });
    if (localBundle) {
      let submissions: Submission[] = localBundle.submissions;

      if (shouldRefresh && uuidPattern.test(taskId)) {
        let remoteSubmissions: Submission[] = [];

        try {
          const taskService = await getTaskService(user, {
            queryRetryDelaysMs: [],
            queryTimeoutMs: SUBMISSION_REMOTE_REFRESH_TIMEOUT_MS
          });
          remoteSubmissions = normalizeSubmissions(await taskService.service.getSubmissions(taskId));
        } catch (remoteError) {
          console.warn(`读取远程交付结果失败，使用本地结果兜底：${getErrorMessage(remoteError)}`);
        }

        if (remoteSubmissions.length > 0) {
          const localSubmissionsById = new Map(submissions.map((submission) => [submission.submissionId, submission]));
          await Promise.all(
            remoteSubmissions.map((submission) =>
              upsertSubmission({
                orderId: localBundle.orderId,
                submission
              })
            )
          );

          submissions = remoteSubmissions.map((submission) => {
            const localSubmission = localSubmissionsById.get(submission.submissionId);
            return {
              ...submission,
              selected: localSubmission?.selected || submission.selected || localBundle.selectedSubmissionId === submission.submissionId,
              status:
                localSubmission?.selected || submission.selected || localBundle.selectedSubmissionId === submission.submissionId
                  ? "approved"
                  : localSubmission?.status || submission.status
            };
          });
        }
      }

      return NextResponse.json({
        submissions,
        source: "supabase"
      });
    }

    if (!uuidPattern.test(taskId)) {
      return NextResponse.json({
        submissions: [],
        source: "legacy-local"
      });
    }

    return NextResponse.json({ error: "订单不存在，或你没有权限查看这条订单的结果" }, { status: 404 });
  } catch (error) {
    const message = getErrorMessage(error, "读取交付结果失败");
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
