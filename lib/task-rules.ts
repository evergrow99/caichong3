import type { PublishTask } from "@/lib/caichong";

export const selectionWindowMs = 24 * 60 * 60 * 1000;

export const taskStatusLabels: Record<string, string> = {
  PENDING_PAYMENT: "待支付",
  ACTIVE: "提交期",
  PENDING_SELECTION: "选择期",
  COMPLETED: "已完成",
  CLOSED: "已关闭"
};

export const taskStatusRules = [
  {
    status: "PENDING_PAYMENT",
    label: taskStatusLabels.PENDING_PAYMENT,
    userMeaning: "任务已创建，但用户还没有付款；普通用户通常不把它理解成正式订单。",
    timeRule: "支付链接 30 分钟有效；创建后 24 小时未付款自动关闭。",
    userAction: "完成付款，或放弃不付款。",
    systemAction: "可刷新支付链接；未付款超时后关闭。",
    canSelectSubmission: false,
    canReceiveSubmission: false,
    isTerminal: false
  },
  {
    status: "ACTIVE",
    label: taskStatusLabels.ACTIVE,
    userMeaning: "付款成功，任务进入 72 小时提交期；Agent 可以投稿。",
    timeRule: "从 paidAt 开始计算 72 小时提交期。",
    userAction: "等待投稿；收到满意投稿后可以提前采用。",
    systemAction: "同步投稿和状态；提交期结束无人投稿会关闭，有投稿会进入选择期。",
    canSelectSubmission: true,
    canReceiveSubmission: true,
    isTerminal: false
  },
  {
    status: "PENDING_SELECTION",
    label: taskStatusLabels.PENDING_SELECTION,
    userMeaning: "提交期已结束并进入 24 小时选择期；用户应尽快采用投稿。",
    timeRule: "选择期 24 小时，超时未采用会关闭并退款。",
    userAction: "阅读投稿并采用一份。",
    systemAction: "继续同步状态和已收到的投稿详情；平台代理短信只到运营侧，后台需要兜底提醒用户；选择期超时关闭。",
    canSelectSubmission: true,
    canReceiveSubmission: false,
    isTerminal: false
  },
  {
    status: "COMPLETED",
    label: taskStatusLabels.COMPLETED,
    userMeaning: "用户已采用投稿，订单完成结算。",
    timeRule: "终态，无需继续心跳。",
    userAction: "查看历史结果和附件。",
    systemAction: "保留记录，不再主动同步。",
    canSelectSubmission: false,
    canReceiveSubmission: false,
    isTerminal: true
  },
  {
    status: "CLOSED",
    label: taskStatusLabels.CLOSED,
    userMeaning: "订单因超时或其他原因关闭。",
    timeRule: "终态，关闭后不可恢复，需重新发单。",
    userAction: "查看关闭原因；如仍有需求，重新发布任务。",
    systemAction: "保留记录，不再主动同步。",
    canSelectSubmission: false,
    canReceiveSubmission: false,
    isTerminal: true
  }
] as const;

export function getTaskStatusLabel(status?: string) {
  if (!status) return "未知状态";
  return taskStatusLabels[status] || status;
}

export function getTaskStatusRule(status?: string) {
  return taskStatusRules.find((rule) => rule.status === status);
}

export function isSyncableTaskStatus(status?: string) {
  return status === "PENDING_PAYMENT" || status === "ACTIVE" || status === "PENDING_SELECTION";
}

export function getDerivedTaskLifecycle(
  task: Pick<PublishTask, "status" | "deadlineAt" | "submissionCount" | "closeReason">,
  now = new Date()
): Partial<Pick<PublishTask, "status" | "deadlineAt" | "closeReason">> | null {
  if (!task.deadlineAt || (task.status !== "ACTIVE" && task.status !== "PENDING_SELECTION")) {
    return null;
  }

  const deadline = new Date(task.deadlineAt);
  if (Number.isNaN(deadline.getTime()) || deadline.getTime() > now.getTime()) {
    return null;
  }

  if (task.status === "ACTIVE") {
    if ((task.submissionCount || 0) > 0) {
      const selectionDeadline = new Date(deadline.getTime() + selectionWindowMs).toISOString();

      if (new Date(selectionDeadline).getTime() <= now.getTime()) {
        return {
          status: "CLOSED",
          deadlineAt: selectionDeadline,
          closeReason: task.closeReason || "TIMEOUT_NO_SELECTION"
        };
      }

      return {
        status: "PENDING_SELECTION",
        deadlineAt: selectionDeadline,
        closeReason: undefined
      };
    }

    return {
      status: "CLOSED",
      deadlineAt: task.deadlineAt,
      closeReason: task.closeReason || "TIMEOUT_NO_SUBMISSION"
    };
  }

  return {
    status: "CLOSED",
    deadlineAt: task.deadlineAt,
    closeReason: task.closeReason || "TIMEOUT_NO_SELECTION"
  };
}

export function canSelectSubmission(task: Pick<PublishTask, "status">) {
  return task.status === "ACTIVE" || task.status === "PENDING_SELECTION";
}

export function getTaskStep(status?: string) {
  if (status === "PENDING_PAYMENT") return 2;
  if (status === "ACTIVE" || status === "PENDING_SELECTION") return 3;
  if (status === "COMPLETED" || status === "CLOSED") return 4;
  return 1;
}

export function getEmptySubmissionText(status?: string, expectedCount = 0) {
  if (status === "PENDING_PAYMENT") return "完成付款后，任务才会正式发布";
  if (status === "ACTIVE" && expectedCount > 0) return "订单显示已有投稿，但暂时没有读到详情。请稍后刷新查看。";
  if (status === "PENDING_SELECTION" && expectedCount > 0) return "暂时没有读到投稿详情，请稍后刷新查看。";
  return "暂未收到投稿";
}

export function getCloseReasonLabel(reason?: string) {
  if (reason === "TIMEOUT_NO_PAYMENT") return "创建后 24 小时未付款，订单已关闭";
  if (reason === "TIMEOUT_NO_SUBMISSION") return "提交期内无人投稿，订单已关闭并退款";
  if (reason === "TIMEOUT_NO_SELECTION") return "选择期内未采用投稿，订单已关闭并退款";
  return reason || "";
}
