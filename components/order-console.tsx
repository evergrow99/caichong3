"use client";

import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";
import type { PublishTask, Submission } from "@/lib/caichong";

type PendingAttachment = {
  file: File;
  fileName: string;
  fileSize: number;
  mimeType: string;
};

type UploadedAttachment = {
  fileUrl: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
};

type CurrentUser = {
  id: string;
  phone: string;
  displayName: string;
  authMode: "mock" | "phone";
};

type ConfigHealth = {
  caichong: {
    hasApiKey: boolean;
    useMock: boolean;
    baseUrl: string;
  };
  supabase: {
    ready: boolean;
    hasUrl: boolean;
    hasAnonKey: boolean;
    hasServiceRoleKey: boolean;
  };
};

type TaskFilter = "all" | "ACTIVE" | "PENDING_SELECTION" | "COMPLETED" | "CLOSED";
type IconName = "logo" | "plus" | "activity" | "rules" | "work" | "logout" | "collapse" | "chevron" | "attachment" | "user";

const MAX_ATTACHMENTS = 5;
const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024;
const MIN_DESCRIPTION_LENGTH = 10;
const isPhoneValid = (phone: string) => /^1\d{10}$/.test(phone);
const isCodeValid = (code: string) => /^\d{6}$/.test(code);

const statusLabels: Record<string, string> = {
  PENDING_PAYMENT: "待支付",
  ACTIVE: "提交期",
  PENDING_SELECTION: "选择期",
  COMPLETED: "已完成",
  CLOSED: "已关闭"
};

const taskFilters: { key: TaskFilter; label: string }[] = [
  { key: "all", label: "全部" },
  { key: "ACTIVE", label: "提交期" },
  { key: "PENDING_SELECTION", label: "选择期" },
  { key: "COMPLETED", label: "已完成" },
  { key: "CLOSED", label: "已关闭" }
];

const exampleCases = [
  {
    type: "文字",
    title: "小红书护肤文案",
    request: "为新品面霜写 3 条自然种草内容。",
    result: "交付可直接发布的标题、正文和标签建议。",
    visual: "text"
  },
  {
    type: "图片",
    title: "咖啡店海报方向",
    request: "为周末活动生成一张海报参考。",
    result: "交付画面描述、风格方向和可复用提示词。",
    visual: "image"
  },
  {
    type: "音乐",
    title: "短视频背景音乐",
    request: "需要 15 秒轻快、适合生活方式视频的音乐。",
    result: "交付节奏说明、情绪关键词和制作建议。",
    visual: "music"
  },
  {
    type: "视频",
    title: "产品介绍脚本",
    request: "为新品做 30 秒视频脚本。",
    result: "交付分镜、旁白和字幕节奏。",
    visual: "video"
  }
];

function CaseVisual({ type }: { type: string }) {
  return (
    <svg className={`case-visual ${type}`} aria-hidden="true" viewBox="0 0 420 180" role="img">
      {type === "text" ? (
        <>
          <rect x="0" y="0" width="420" height="180" rx="18" />
          <rect x="28" y="30" width="180" height="16" rx="8" />
          <rect x="28" y="62" width="300" height="10" rx="5" />
          <rect x="28" y="86" width="250" height="10" rx="5" />
          <rect x="28" y="120" width="92" height="28" rx="14" />
          <rect x="132" y="120" width="78" height="28" rx="14" />
        </>
      ) : null}
      {type === "image" ? (
        <>
          <rect x="0" y="0" width="420" height="180" rx="18" />
          <circle cx="318" cy="58" r="28" />
          <path d="M42 146l76-68 54 45 42-34 78 57H42z" />
          <rect x="278" y="118" width="90" height="18" rx="9" />
        </>
      ) : null}
      {type === "music" ? (
        <>
          <rect x="0" y="0" width="420" height="180" rx="18" />
          <path d="M66 96c26-42 54-42 80 0s54 42 80 0 54-42 80 0" />
          <circle cx="114" cy="116" r="20" />
          <path d="M134 116V48l82-16v68" />
          <circle cx="216" cy="100" r="20" />
          <rect x="282" y="48" width="66" height="84" rx="16" />
        </>
      ) : null}
      {type === "video" ? (
        <>
          <rect x="0" y="0" width="420" height="180" rx="18" />
          <rect x="36" y="34" width="210" height="118" rx="14" />
          <path d="M126 70l60 34-60 34V70z" />
          <rect x="272" y="42" width="92" height="18" rx="9" />
          <rect x="272" y="78" width="70" height="18" rx="9" />
          <rect x="272" y="114" width="100" height="18" rx="9" />
        </>
      ) : null}
    </svg>
  );
}

function Icon({ name }: { name: IconName }) {
  const commonProps = {
    "aria-hidden": true,
    className: "ui-icon",
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth: 2,
    viewBox: "0 0 24 24"
  };

  if (name === "logo") {
    return (
      <svg {...commonProps}>
        <path d="M12 3l2.4 5.2L20 10.6l-5.2 2.5L12 21l-2.8-7.9L4 10.6l5.6-2.4L12 3z" />
      </svg>
    );
  }

  if (name === "plus") {
    return (
      <svg {...commonProps}>
        <path d="M12 5v14" />
        <path d="M5 12h14" />
      </svg>
    );
  }

  if (name === "activity") {
    return (
      <svg {...commonProps}>
        <path d="M4 12h4l2-6 4 12 2-6h4" />
      </svg>
    );
  }

  if (name === "rules") {
    return (
      <svg {...commonProps}>
        <path d="M7 4h10a2 2 0 0 1 2 2v14H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
        <path d="M9 8h6" />
        <path d="M9 12h6" />
        <path d="M9 16h4" />
      </svg>
    );
  }

  if (name === "work") {
    return (
      <svg {...commonProps}>
        <path d="M8 7V6a3 3 0 0 1 3-3h2a3 3 0 0 1 3 3v1" />
        <path d="M5 7h14a2 2 0 0 1 2 2v9a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V9a2 2 0 0 1 2-2z" />
        <path d="M9 13h6" />
      </svg>
    );
  }

  if (name === "collapse") {
    return (
      <svg {...commonProps}>
        <path d="M4 5h16v14H4z" />
        <path d="M9 5v14" />
        <path d="M16 9l-3 3 3 3" />
      </svg>
    );
  }

  if (name === "chevron") {
    return (
      <svg {...commonProps}>
        <path d="M6 9l6 6 6-6" />
      </svg>
    );
  }

  if (name === "attachment") {
    return (
      <svg {...commonProps}>
        <path d="M21 11.5l-8.7 8.7a6 6 0 0 1-8.5-8.5l9.1-9.1a4 4 0 0 1 5.7 5.7l-9.2 9.2a2 2 0 0 1-2.8-2.8l8.6-8.6" />
      </svg>
    );
  }

  if (name === "user") {
    return (
      <svg {...commonProps}>
        <path d="M20 21a8 8 0 0 0-16 0" />
        <path d="M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10z" />
      </svg>
    );
  }

  return (
    <svg {...commonProps}>
      <path d="M10 17l5-5-5-5" />
      <path d="M15 12H3" />
      <path d="M14 4h4a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3h-4" />
    </svg>
  );
}

function getStatusLabel(status?: string) {
  if (!status) return "未知状态";
  return statusLabels[status] || status;
}

function getStatusGuidance(status?: string, submissionCount = 0) {
  if (status === "PENDING_PAYMENT") return "下一步：完成付款。付款后点“刷新”，任务会进入处理中。";
  if (status === "ACTIVE" && submissionCount > 0) return "已经收到交付结果。请查看下方内容，确认满意后采用一个结果完成任务。";
  if (status === "ACTIVE") return "任务正在处理中。可以隔一段时间点“刷新”查看新结果。";
  if (status === "PENDING_SELECTION") return "已经可以处理交付结果了。请阅读结果后采用一份，任务会完成结算。";
  if (status === "COMPLETED") return "这单已经完成结算，后续只需要保留记录。";
  if (status === "CLOSED") return "这单已经关闭，不能继续付款或采用结果。";
  return "订单状态已记录，可以刷新详情或任务进展确认最新状态。";
}

function getTaskNextAction(task: PublishTask) {
  if (task.status === "PENDING_PAYMENT") return "待付款";
  if (task.status === "ACTIVE") return "提交期";
  if (task.status === "PENDING_SELECTION") return "选择期";
  if (task.status === "COMPLETED") return "已结算";
  if (task.status === "CLOSED") return "已关闭";
  return "待确认";
}

function getTaskStep(status?: string) {
  if (status === "PENDING_PAYMENT") return 2;
  if (status === "ACTIVE" || status === "PENDING_SELECTION") return 3;
  if (status === "COMPLETED" || status === "CLOSED") return 4;
  return 1;
}

function getPrimaryDetailAction(status?: string, submissionCount = 0) {
  if (status === "PENDING_PAYMENT") return "请先完成付款";
  if (status === "ACTIVE" && submissionCount > 0) return "查看交付结果";
  if (status === "ACTIVE") return "等待交付结果";
  if (status === "PENDING_SELECTION") return "选择满意结果";
  if (status === "COMPLETED") return "任务已完成";
  if (status === "CLOSED") return "任务已关闭";
  return "查看任务进展";
}

function getEmptySubmissionText(status?: string, expectedCount = 0) {
  if (status === "PENDING_PAYMENT") return "这单还没有付款，所以暂时不会开始处理。";
  if (status === "ACTIVE" && expectedCount > 0) return "订单显示已有结果，但暂时没读到详情。请点“刷新”再试。";
  if (status === "ACTIVE") return "任务已经进行中，但还没有收到交付结果。可以稍后点“刷新”。";
  if (status === "PENDING_SELECTION") return "订单已进入选择期，但暂时没有读到结果。请点“刷新”再试。";
  if (status === "COMPLETED") return "这单已经完成，当前没有可继续选择的结果。";
  if (status === "CLOSED") return "这单已经关闭，当前没有可处理的结果。";
  return "这单暂时没有交付结果。";
}

function getSubmissionDisplayStatus(submission: Submission, taskStatus?: string) {
  if (submission.selected) return "已采用";
  if (taskStatus === "COMPLETED" || taskStatus === "CLOSED") return "未采用";
  return "待选择";
}

function formatDateTimeToMinute(value?: string) {
  if (!value) return "";
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
}

function formatFileSize(bytes?: number) {
  if (!bytes || bytes <= 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function getAttachmentDownloadUrl(attachment: { fileUrl: string; fileName?: string }, disposition: "attachment" | "inline" = "attachment") {
  const params = new URLSearchParams({
    url: attachment.fileUrl,
    filename: attachment.fileName || "submission-attachment",
    disposition
  });
  return `/api/download/submission-attachment?${params.toString()}`;
}

function isTextLikeAttachment(fileName?: string, contentType = "") {
  const normalizedName = (fileName || "").toLowerCase();
  return (
    contentType.includes("text/") ||
    contentType.includes("json") ||
    normalizedName.endsWith(".txt") ||
    normalizedName.endsWith(".md") ||
    normalizedName.endsWith(".markdown") ||
    normalizedName.endsWith(".json") ||
    normalizedName.endsWith(".csv")
  );
}

function getDisplayTaskDescription(description: string) {
  return description
    .replace(/^真实接口联调测试：?/, "")
    .replace(/^真实接口测试订单：?/, "测试任务：")
    .replace("这是平台联调使用的小额测试任务。", "这是一条小额测试任务。");
}

function isSyncableTask(task: PublishTask) {
  return ["PENDING_PAYMENT", "ACTIVE", "PENDING_SELECTION"].includes(task.status);
}

async function readJson<T>(response: Response): Promise<T> {
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "请求失败");
  }
  return data as T;
}

export function OrderConsole() {
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("10");
  const [loginPhone, setLoginPhone] = useState("");
  const [loginCode, setLoginCode] = useState("");
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const [tasks, setTasks] = useState<PublishTask[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<PublishTask | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [dataSource, setDataSource] = useState<"mock" | "caichong" | "supabase" | "unknown">("unknown");
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [configHealth, setConfigHealth] = useState<ConfigHealth | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isRefreshingPayment, setIsRefreshingPayment] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [codeCooldown, setCodeCooldown] = useState(0);
  const [uploadProgressText, setUploadProgressText] = useState<string | null>(null);
  const [selectingSubmissionId, setSelectingSubmissionId] = useState<string | null>(null);
  const [previewByAttachmentUrl, setPreviewByAttachmentUrl] = useState<Record<string, string>>({});
  const [previewLoadingUrl, setPreviewLoadingUrl] = useState<string | null>(null);
  const [downloadingAttachmentUrl, setDownloadingAttachmentUrl] = useState<string | null>(null);
  const [taskFilter, setTaskFilter] = useState<TaskFilter>("all");
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const [isSubmissionsCollapsed, setIsSubmissionsCollapsed] = useState(false);
  const [lastRefreshAt, setLastRefreshAt] = useState<string | null>(null);
  const filterMenuRef = useRef<HTMLElement | null>(null);
  const accountMenuRef = useRef<HTMLDivElement | null>(null);
  const canLogin = isPhoneValid(loginPhone) && isCodeValid(loginCode) && !isLoggingIn;
  const canSendCode = isPhoneValid(loginPhone) && !isSendingCode && codeCooldown === 0;
  const isPhoneLoggedIn = currentUser?.authMode === "phone";
  const isPublishDisabled = !isPhoneLoggedIn || isCreating;
  const descriptionLength = description.trim().length;
  const selectedTaskStep = getTaskStep(selectedTask?.status);
  const visibleTasks = tasks.filter((task) => task.status !== "PENDING_PAYMENT");
  const filteredTasks = visibleTasks.filter((task) => taskFilter === "all" || task.status === taskFilter);
  const hasCurrentUserSyncableTasks = tasks.some(isSyncableTask);

  function updateSelectedTask(taskId: string | null) {
    setSelectedTaskId(taskId);

    if (typeof window === "undefined") {
      return;
    }

    const nextUrl = new URL(window.location.href);
    if (taskId) {
      nextUrl.searchParams.set("task", taskId);
    } else {
      nextUrl.searchParams.delete("task");
    }

    window.history.replaceState(null, "", `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`);
  }

  async function loadTasks() {
    setIsLoading(true);
    setError(null);

    try {
      const data = await readJson<{ tasks: PublishTask[]; source?: "mock" | "caichong" | "supabase" }>(
        await fetch("/api/tasks?page=1&pageSize=20")
      );
      setTasks(data.tasks || []);
      setDataSource(data.source || "unknown");
      setLastRefreshAt(new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }));

    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "订单读取失败");
    } finally {
      setIsLoading(false);
    }
  }

  async function loadCurrentUser() {
    try {
      const user = await readJson<CurrentUser>(await fetch("/api/me"));
      setCurrentUser(user);
    } catch {
      setCurrentUser(null);
    }
  }

  async function loadConfigHealth() {
    try {
      const config = await readJson<ConfigHealth>(await fetch("/api/health/config"));
      setConfigHealth(config);
    } catch {
      setConfigHealth(null);
    }
  }

  async function loadTaskDetail(taskId: string) {
    setIsDetailLoading(true);
    setError(null);

    try {
      const task = await readJson<PublishTask>(await fetch(`/api/tasks/${taskId}`));
      setSelectedTask(task);

      try {
        const submissionData = await readJson<{ submissions?: Submission[] } | Submission[]>(await fetch(`/api/tasks/${taskId}/submissions`));
        setSubmissions(Array.isArray(submissionData) ? submissionData : submissionData.submissions || []);
      } catch {
        setSubmissions([]);
      }

      setLastRefreshAt(new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }));
    } catch (detailError) {
      setError(detailError instanceof Error ? detailError.message : "订单详情读取失败");
      setSelectedTask(null);
      setSubmissions([]);
    } finally {
      setIsDetailLoading(false);
    }
  }

  async function refreshPaymentUrl(taskId: string) {
    setIsRefreshingPayment(true);
    setMessage(null);
    setError(null);

    try {
      const data = await readJson<{ paymentUrl: string }>(
        await fetch(`/api/tasks/${taskId}/payment-url`, {
          method: "POST"
        })
      );

      setSelectedTask((task) => (task ? { ...task, paymentUrl: data.paymentUrl } : task));
      setMessage("付款入口已刷新。");
    } catch (paymentError) {
      setError(paymentError instanceof Error ? paymentError.message : "付款入口刷新失败");
    } finally {
      setIsRefreshingPayment(false);
    }
  }

  async function uploadPendingAttachments() {
    const uploaded: UploadedAttachment[] = [];

    if (attachments.length === 0) {
      return uploaded;
    }

    for (const [index, attachment] of attachments.entries()) {
      setUploadProgressText(`正在上传附件 ${index + 1}/${attachments.length}：${attachment.fileName}`);
      const formData = new FormData();
      formData.append("file", attachment.file);

      const uploadedAttachment = await readJson<UploadedAttachment>(
        await fetch("/api/uploads/task-attachment", {
          method: "POST",
          body: formData
        })
      );

      uploaded.push(uploadedAttachment);
    }

    return uploaded;
  }

  async function previewAttachment(attachment: UploadedAttachment) {
    setPreviewLoadingUrl(attachment.fileUrl);
    setError(null);

    try {
      const response = await fetch(getAttachmentDownloadUrl(attachment, "inline"));
      if (!response.ok) {
        throw new Error("附件预览失败");
      }

      const contentType = response.headers.get("content-type") || "";
      if (!isTextLikeAttachment(attachment.fileName, contentType)) {
        setPreviewByAttachmentUrl((current) => ({
          ...current,
          [attachment.fileUrl]: "这个附件不是文本文件，请使用下载按钮保存后查看。"
        }));
        return;
      }

      const text = await response.text();
      setPreviewByAttachmentUrl((current) => ({
        ...current,
        [attachment.fileUrl]: text || "文件内容为空。"
      }));
    } catch (previewError) {
      setError(previewError instanceof Error ? previewError.message : "附件预览失败");
    } finally {
      setPreviewLoadingUrl(null);
    }
  }

  async function downloadAttachment(attachment: UploadedAttachment) {
    setDownloadingAttachmentUrl(attachment.fileUrl);
    setError(null);

    try {
      const response = await fetch(getAttachmentDownloadUrl(attachment));
      if (!response.ok) {
        throw new Error("附件下载失败");
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = attachment.fileName || "submission-attachment";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
      setMessage(`已触发下载：${attachment.fileName || "交付附件"}`);
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : "附件下载失败");
    } finally {
      setDownloadingAttachmentUrl(null);
    }
  }

  async function selectSubmission(taskId: string, submissionId: string) {
    const confirmed = window.confirm("采用结果后，这条任务会进入完成状态。确认采用这个结果吗？");
    if (!confirmed) {
      return;
    }

    setSelectingSubmissionId(submissionId);
    setMessage(null);
    setError(null);

    try {
      const task = await readJson<PublishTask>(
        await fetch(`/api/tasks/${taskId}/select`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json; charset=utf-8"
          },
          body: JSON.stringify({ submissionId })
        })
      );

      setSelectedTask(task);
      setMessage("已采用结果，任务已完成。");
      await Promise.all([loadTasks(), loadTaskDetail(taskId)]);
    } catch (selectError) {
      setError(selectError instanceof Error ? selectError.message : "采用结果失败");
    } finally {
      setSelectingSubmissionId(null);
    }
  }

  async function syncHeartbeat() {
    setIsSyncing(true);
    setMessage(null);
    setError(null);

    try {
      const data = await readJson<{ checkedEvents: number; messages: string[] }>(
        await fetch("/api/sync/heartbeat", {
          method: "POST"
        })
      );

      const detailMessage =
        data.messages.length > 0 ? data.messages.join("；") : `已刷新，暂无新变化。`;
      setMessage(detailMessage);
      setLastRefreshAt(new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }));
      await loadTasks();

      if (selectedTaskId) {
        await loadTaskDetail(selectedTaskId);
      }
    } catch (syncError) {
      setError(syncError instanceof Error ? syncError.message : "刷新失败");
    } finally {
      setIsSyncing(false);
    }
  }

  async function sendLoginCode() {
    if (!isPhoneValid(loginPhone)) {
      setError("请输入 11 位中国大陆手机号");
      return;
    }

    setIsSendingCode(true);
    setMessage(null);
    setError(null);

    try {
      await readJson<{ ok: boolean; message?: string }>(
        await fetch("/api/auth/send-code", {
          method: "POST",
          headers: {
            "Content-Type": "application/json; charset=utf-8"
          },
          body: JSON.stringify({
            phone: loginPhone
          })
        })
      );
      setMessage("验证码已发送，请查看短信。");
      setCodeCooldown(60);
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "验证码发送失败");
    } finally {
      setIsSendingCode(false);
    }
  }

  async function loginWithPhoneCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isPhoneValid(loginPhone)) {
      setError("请输入 11 位中国大陆手机号");
      return;
    }

    if (!isCodeValid(loginCode)) {
      setError("请输入 6 位数字验证码");
      return;
    }

    setIsLoggingIn(true);
    setMessage(null);
    setError(null);

    try {
      const user = await readJson<CurrentUser>(
        await fetch("/api/auth/verify-code", {
          method: "POST",
          headers: {
            "Content-Type": "application/json; charset=utf-8"
          },
          body: JSON.stringify({
            phone: loginPhone,
            code: loginCode
          })
        })
      );

      setCurrentUser(user);
      setMessage(null);
      setIsLoginOpen(false);
      await loadTasks();
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "登录失败");
    } finally {
      setIsLoggingIn(false);
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", {
      method: "POST"
    });
    setCurrentUser(null);
    updateSelectedTask(null);
    setSelectedTask(null);
    setSubmissions([]);
    await loadCurrentUser();
    await loadTasks();
  }

  function addAttachments(files: FileList | null) {
    if (!files?.length) return;

    const nextFiles = Array.from(files);
    const accepted: PendingAttachment[] = [];

    for (const file of nextFiles) {
      if (attachments.length + accepted.length >= MAX_ATTACHMENTS) {
        setError(`最多只能上传 ${MAX_ATTACHMENTS} 个附件`);
        break;
      }

      if (file.size > MAX_ATTACHMENT_SIZE) {
        setError(`${file.name} 超过 10MB，已跳过`);
        continue;
      }

      accepted.push({
        file,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type || "application/octet-stream"
      });
    }

    if (accepted.length > 0) {
      setAttachments((current) => [...current, ...accepted]);
    }
  }

  function removeAttachment(index: number) {
    setAttachments((current) => current.filter((_, itemIndex) => itemIndex !== index));
  }

  async function createTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isPhoneLoggedIn) {
      setError("请先用手机号登录后再发布订单");
      return;
    }

    const trimmedDescription = description.trim();
    const numericPrice = Number(price);

    if (trimmedDescription.length < MIN_DESCRIPTION_LENGTH) {
      setError("请输入10个字以上的需求描述");
      return;
    }

    if (!Number.isFinite(numericPrice) || numericPrice < 1 || numericPrice > 100) {
      setError("请输入1-100元的报酬");
      return;
    }

    setIsCreating(true);
    setMessage(null);
    setError(null);
    setUploadProgressText(null);

    try {
      const uploadedAttachments = await uploadPendingAttachments();
      setUploadProgressText(uploadedAttachments.length > 0 ? "附件已上传，正在创建订单..." : "正在创建订单...");
      const task = await readJson<PublishTask>(
        await fetch("/api/tasks", {
          method: "POST",
          headers: {
            "Content-Type": "application/json; charset=utf-8"
          },
          body: JSON.stringify({
            description: trimmedDescription,
            price: numericPrice,
            attachments: uploadedAttachments
          })
        })
      );

      setMessage(task.paymentUrl ? "任务已创建，请在订单详情中完成付款。" : "任务已创建，请到任务列表查看进展。");
      setDescription("");
      setAttachments([]);
      updateSelectedTask(task.taskId);
      await loadTasks();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "发单失败");
    } finally {
      setIsCreating(false);
      setUploadProgressText(null);
    }
  }

  useEffect(() => {
    loadCurrentUser();
    loadConfigHealth();
    loadTasks();
  }, []);

  useEffect(() => {
    const taskIdFromUrl = new URLSearchParams(window.location.search).get("task");
    if (taskIdFromUrl) {
      setSelectedTaskId(taskIdFromUrl);
    }
  }, []);

  useEffect(() => {
    if (selectedTaskId) {
      loadTaskDetail(selectedTaskId);
    } else {
      setSelectedTask(null);
      setSubmissions([]);
    }
  }, [selectedTaskId]);

  useEffect(() => {
    if (!isPhoneLoggedIn || !hasCurrentUserSyncableTasks) {
      return;
    }

    const timer = window.setInterval(() => {
      void syncHeartbeat();
    }, 30 * 60 * 1000);

    return () => window.clearInterval(timer);
  }, [isPhoneLoggedIn, hasCurrentUserSyncableTasks, selectedTaskId]);

  useEffect(() => {
    function closeFloatingMenus(event: MouseEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;

      if (filterMenuRef.current && !filterMenuRef.current.contains(target)) {
        setIsFilterOpen(false);
      }

      if (accountMenuRef.current && !accountMenuRef.current.contains(target)) {
        setIsAccountMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", closeFloatingMenus);
    return () => document.removeEventListener("mousedown", closeFloatingMenus);
  }, []);

  useEffect(() => {
    if (codeCooldown <= 0) {
      return;
    }

    const timer = window.setTimeout(() => setCodeCooldown((seconds) => Math.max(0, seconds - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [codeCooldown]);

  return (
    <main className={`studio-shell ${isSidebarCollapsed ? "sidebar-collapsed" : ""}`}>
      <button
        aria-label="打开菜单"
        className="mobile-menu-button"
        type="button"
        onClick={() => setIsMenuOpen(true)}
      >
        <span />
        <span />
        <span />
        {visibleTasks.length > 0 ? <strong>{visibleTasks.length}</strong> : null}
      </button>

      {isMenuOpen ? <button className="drawer-backdrop" aria-label="关闭菜单" type="button" onClick={() => setIsMenuOpen(false)} /> : null}

      <aside className={`studio-sidebar ${isMenuOpen ? "open" : ""}`}>
        <div className="studio-brand-block">
          <Link className="studio-brand" href="/" onClick={() => setIsMenuOpen(false)}>
            <span className="prototype-logo">
              <Icon name="logo" />
            </span>
            <span className="sidebar-label">
              <strong>任务市场</strong>
              <small>一句话发任务，等结果来找你</small>
            </span>
          </Link>
          <button
            aria-label={isSidebarCollapsed ? "展开侧栏" : "收起侧栏"}
            className="sidebar-collapse-button"
            type="button"
            onClick={() => setIsSidebarCollapsed((collapsed) => !collapsed)}
          >
            <Icon name="collapse" />
          </button>
          <button className="drawer-close sidebar-close" type="button" onClick={() => setIsMenuOpen(false)}>
            收起
          </button>
        </div>

        <nav className="studio-menu">
          <button
            className={!selectedTaskId ? "active" : ""}
            type="button"
            onClick={() => {
              updateSelectedTask(null);
              setIsMenuOpen(false);
            }}
          >
            <span className="nav-icon-slot">
              <Icon name="plus" />
            </span>
            <span className="sidebar-label">新建任务</span>
          </button>
        </nav>

        <section className="sidebar-orders" ref={filterMenuRef}>
          <button className="sidebar-section-toggle" type="button" onClick={() => setIsFilterOpen((open) => !open)}>
            <span className="sidebar-label">历史任务</span>
            <span className={`filter-arrow ${isFilterOpen ? "open" : ""}`}>
              <Icon name="chevron" />
            </span>
          </button>
          <div className={`sidebar-filter-menu ${isFilterOpen ? "open" : ""}`}>
            {taskFilters.map((filter) => (
              <button
                className={taskFilter === filter.key ? "active" : ""}
                key={filter.key}
                type="button"
                onClick={() => {
                  setTaskFilter(filter.key);
                  setIsFilterOpen(false);
                }}
              >
                {filter.label}
              </button>
            ))}
          </div>

          <div className="sidebar-task-list">
            {filteredTasks.length > 0 ? (
              filteredTasks.map((task) => (
                <button
                  className={`sidebar-task ${selectedTaskId === task.taskId ? "active" : ""}`}
                  key={task.taskId}
                  onClick={() => {
                    updateSelectedTask(task.taskId);
                    setIsMenuOpen(false);
                  }}
                  type="button"
                >
                  <span className="sidebar-task-title">{getDisplayTaskDescription(task.description)}</span>
                  <span className="sidebar-task-meta">
                    <span>{getStatusLabel(task.status)}</span>
                    <span>{task.submissionCount || 0}接单</span>
                  </span>
                </button>
              ))
            ) : (
              <div className="sidebar-empty">{isPhoneLoggedIn ? "暂无历史任务" : "登录后查看订单列表"}</div>
            )}
          </div>
        </section>

        <nav className="studio-bottom-links">
          <Link href="/market-rules" target="_blank" rel="noreferrer" onClick={() => setIsMenuOpen(false)}>
            <span className="nav-icon-slot">
              <Icon name="rules" />
            </span>
            <span className="sidebar-label">市场规则</span>
          </Link>
          <Link href="/work" target="_blank" rel="noreferrer" onClick={() => setIsMenuOpen(false)}>
            <span className="nav-icon-slot">
              <Icon name="work" />
            </span>
            <span className="sidebar-label">我要接单</span>
          </Link>
        </nav>

        <section className="sidebar-account">
          {isPhoneLoggedIn ? (
            <div className="account-popover-wrap" ref={accountMenuRef}>
              {isAccountMenuOpen ? (
                <div className="account-menu">
                  <button type="button" onClick={logout}>
                    <Icon name="logout" />
                    <span>退出登录</span>
                  </button>
                </div>
              ) : null}
              <button className="account-trigger" type="button" onClick={() => setIsAccountMenuOpen((open) => !open)}>
                <span className="nav-icon-slot">
                  <Icon name="user" />
                </span>
                <span className="sidebar-label">{currentUser.phone.slice(-4)}</span>
                <span className={`account-chevron ${isAccountMenuOpen ? "open" : ""}`}>
                  <Icon name="chevron" />
                </span>
              </button>
            </div>
          ) : null}
        </section>
      </aside>

      {!isPhoneLoggedIn ? (
        <button className="studio-login-button" type="button" onClick={() => setIsLoginOpen((open) => !open)}>
          登录/注册
        </button>
      ) : null}

      {isLoginOpen && !isPhoneLoggedIn ? (
        <div className="modal-layer">
          <button className="modal-backdrop" aria-label="关闭登录弹窗" type="button" onClick={() => setIsLoginOpen(false)} />
          <section className="login-modal" role="dialog" aria-modal="true" aria-labelledby="login-title">
            <div className="modal-header">
              <div>
                <h2 id="login-title">登录/注册</h2>
                <p>登录后可以发布任务、查看交付结果和历史记录。</p>
              </div>
              <button aria-label="关闭登录弹窗" type="button" onClick={() => setIsLoginOpen(false)}>
                ×
              </button>
            </div>
            <form className="modal-login-form" onSubmit={loginWithPhoneCode}>
              <label>
                手机号
                <input
                  aria-label="手机号"
                  maxLength={11}
                  inputMode="tel"
                  placeholder="请输入手机号"
                  value={loginPhone}
                  onChange={(event) => setLoginPhone(event.target.value.replace(/\D/g, "").slice(0, 11))}
                  required
                />
              </label>
              <label>
                验证码
                <span className="code-input-row">
                  <input
                    aria-label="验证码"
                    maxLength={6}
                    inputMode="numeric"
                    placeholder="请输入验证码"
                    value={loginCode}
                    onChange={(event) => setLoginCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                    required
                  />
                  <button type="button" onClick={sendLoginCode} disabled={!canSendCode}>
                    {isSendingCode ? "发送中" : codeCooldown > 0 ? `${codeCooldown}s` : "获取验证码"}
                  </button>
                </span>
              </label>
              <button className="btn primary" disabled={!canLogin} type="submit">
                {isLoggingIn ? "登录中" : "登录"}
              </button>
            </form>
          </section>
        </div>
      ) : null}

      <section className="studio-content">
        {!selectedTaskId ? (
          <div className="studio-home">
            <section className="case-section studio-cases">
              <div className="section-heading">
                <h2>你可以先从这些任务开始</h2>
                <p>用一句需求发起任务，适合文字、图片、音乐和视频等轻量交付。</p>
              </div>
              <div className="case-grid">
                {exampleCases.map((item) => (
                  <article className="case-card" key={item.type}>
                    <CaseVisual type={item.visual} />
                    <span>{item.type}</span>
                    <h3>{item.title}</h3>
                    <p>{item.request}</p>
                    <strong>{item.result}</strong>
                  </article>
                ))}
              </div>
            </section>

            <form className="hero-task-card studio-composer" onSubmit={createTask}>
              <div className="form-body">
                <label className="textarea-field" htmlFor="description">
                  <textarea
                    id="description"
                    aria-label="任务说明"
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder="例如：帮我写 3 条小红书护肤种草文案，语气自然，面向 25-35 岁女性。"
                    disabled={!isPhoneLoggedIn}
                    required
                  />
                </label>

                <div className="task-card-controls">
                  <label className="attachment-control" htmlFor="attachments" aria-label="上传附件">
                    <Icon name="attachment" />
                    <span>上传附件</span>
                    <input
                      id="attachments"
                      multiple
                      type="file"
                      disabled={!isPhoneLoggedIn}
                      onChange={(event) => {
                        addAttachments(event.target.files);
                        event.target.value = "";
                      }}
                    />
                  </label>
                  <label className="budget-control" htmlFor="price">
                    ¥
                    <input
                      id="price"
                      inputMode="decimal"
                      min="1"
                      max="100"
                      step="1"
                      type="number"
                      value={price}
                      onChange={(event) => setPrice(event.target.value)}
                      disabled={!isPhoneLoggedIn}
                      required
                    />
                  </label>
                  <button className="publish-button" type="submit" disabled={isPublishDisabled}>
                    {isCreating ? "发布中" : "发布任务 →"}
                  </button>
                </div>

                {attachments.length > 0 ? (
                  <div className="attachment-list">
                    {attachments.map((attachment, index) => (
                      <div className="attachment-item" key={`${attachment.fileName}-${index}`}>
                        <div>
                          <strong>{attachment.fileName}</strong>
                          <span>{formatFileSize(attachment.fileSize)}</span>
                        </div>
                        <button type="button" onClick={() => removeAttachment(index)}>
                          移除
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}

                {uploadProgressText ? <div className="message neutral">{uploadProgressText}</div> : null}
                {message ? <div className="message ok">{message}</div> : null}
                {error ? <div className="message error">{error}</div> : null}
              </div>
            </form>
          </div>
        ) : (
          <section className="detail-stage">
              <div className="content-body">
                {isDetailLoading ? (
                  <div className="empty-state">正在读取任务详情和交付结果...</div>
                ) : selectedTask ? (
                  <div className="detail-stack">
                    <div className="detail-floating-bar">
                      <section className="progress-panel embedded compact-steps" aria-label="任务进度">
                        {[
                          ["提交任务", "写清需求"],
                          ["完成付款", "任务上线"],
                          ["查看结果", "收到交付"],
                          ["确认采用", "完成任务"]
                        ].map(([title, descriptionText], index) => {
                          const step = index + 1;
                          const isActive = step === selectedTaskStep;
                          const isDone = step < selectedTaskStep || selectedTask.status === "COMPLETED";

                          return (
                            <div className={`progress-step ${isActive ? "active" : ""} ${isDone ? "done" : ""}`} key={title}>
                              <span>{step}</span>
                              <div>
                                <strong>{title}</strong>
                                <p>{descriptionText}</p>
                              </div>
                            </div>
                          );
                        })}
                      </section>
                      <button
                        className="detail-refresh-button"
                        type="button"
                        onClick={() => loadTaskDetail(selectedTask.taskId)}
                        disabled={isDetailLoading}
                      >
                        <span>
                          <Icon name="activity" />
                          {isDetailLoading ? "刷新中" : "刷新"}
                        </span>
                        {lastRefreshAt ? <small>上次刷新 {lastRefreshAt}</small> : null}
                      </button>
                    </div>

                    <div className="detail-card task-detail-card">
                      <div className="section-eyebrow">任务详情</div>
                      <div className="task-topline">
                        <h4 className="detail-title">{getDisplayTaskDescription(selectedTask.description)}</h4>
                        <span className="money">¥{selectedTask.price}</span>
                      </div>
                      <div className="meta-row">
                        <span className="chip">{getStatusLabel(selectedTask.status)}</span>
                        <span className="chip">{selectedTask.submissionCount || 0} 接单</span>
                        {selectedTask.attachments?.length ? <span className="chip">附件 {selectedTask.attachments.length}</span> : null}
                      </div>
                      <div className="time-row">
                        {selectedTask.paidAt || selectedTask.createdAt ? (
                          <span>发布时间 {formatDateTimeToMinute(selectedTask.paidAt || selectedTask.createdAt)}</span>
                        ) : null}
                        {selectedTask.deadlineAt ? <span>提交期结束 {formatDateTimeToMinute(selectedTask.deadlineAt)}</span> : null}
                      </div>

                      {selectedTask.paymentUrl && selectedTask.status === "PENDING_PAYMENT" ? (
                        <div className="payment-box">
                          <span>付款入口</span>
                          <a href={selectedTask.paymentUrl} target="_blank" rel="noreferrer">
                            去付款
                          </a>
                        </div>
                      ) : null}
                    </div>

                    <div className="submissions submission-section">
                      <div className="detail-header">
                        <h3>收到投稿</h3>
                        <div className="header-actions">
                          <span className="chip">{submissions.length} 条</span>
                          <button type="button" onClick={() => setIsSubmissionsCollapsed((value) => !value)}>
                            {isSubmissionsCollapsed ? "展开" : "收起"}
                          </button>
                        </div>
                      </div>

                      {isSubmissionsCollapsed ? null : submissions.length > 0 ? (
                        submissions.map((submission) => (
                          <article className="submission-item" key={submission.submissionId}>
                            <div className="task-topline">
                              <h4 className="submission-title">{submission.agentName || "服务方"}</h4>
                              {submission.selected ? <span className="chip success">已采用</span> : null}
                            </div>
                            <p>{submission.contentSummary || submission.content}</p>
                            <div className="meta-row">
                              {submission.createdAt ? <span className="chip">投稿时间 {formatDateTimeToMinute(submission.createdAt)}</span> : null}
                              {submission.attachments?.length ? <span className="chip">附件 {submission.attachments.length}</span> : null}
                            </div>
                            {submission.attachments?.length ? (
                              <div className="attachment-list compact-list">
                                {submission.attachments.map((attachment, index) => {
                                  const previewText = previewByAttachmentUrl[attachment.fileUrl];

                                  return (
                                    <div className="attachment-preview-group" key={`${attachment.fileUrl}-${index}`}>
                                      <div className="attachment-item linked attachment-row">
                                        <div>
                                          <strong>{attachment.fileName || `交付附件 ${index + 1}`}</strong>
                                          {attachment.fileSize ? <span>{formatFileSize(attachment.fileSize)}</span> : null}
                                        </div>
                                        <div className="attachment-actions">
                                          <button type="button" onClick={() => previewAttachment(attachment)} disabled={previewLoadingUrl === attachment.fileUrl}>
                                            {previewLoadingUrl === attachment.fileUrl ? "读取中" : "预览"}
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => downloadAttachment(attachment)}
                                            disabled={downloadingAttachmentUrl === attachment.fileUrl}
                                          >
                                            {downloadingAttachmentUrl === attachment.fileUrl ? "下载中" : "下载"}
                                          </button>
                                        </div>
                                      </div>
                                      {previewText ? <pre className="attachment-preview">{previewText}</pre> : null}
                                    </div>
                                  );
                                })}
                              </div>
                            ) : null}
                            {selectedTask.status !== "COMPLETED" && selectedTask.status !== "CLOSED" ? (
                              <div className="actions compact">
                                <button
                                  className="btn primary"
                                  type="button"
                                  onClick={() => selectSubmission(selectedTask.taskId, submission.submissionId)}
                                  disabled={Boolean(selectingSubmissionId) || submission.selected}
                                >
                                  {submission.selected ? "已采用" : selectingSubmissionId === submission.submissionId ? "采用中" : "采用投稿"}
                                </button>
                              </div>
                            ) : null}
                          </article>
                        ))
                      ) : (
                        <div className="empty-state">{getEmptySubmissionText(selectedTask.status, selectedTask.submissionCount || 0)}</div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="empty-state">请选择任务，或发布一个新任务。</div>
                )}
              </div>
            </section>
        )}
      </section>
    </main>
  );
}
