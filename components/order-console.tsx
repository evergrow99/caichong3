"use client";

import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";
import type { PublishTask, Submission } from "@/lib/caichong";
import {
  canSelectSubmission,
  getCloseReasonLabel,
  getEmptySubmissionText,
  getTaskStatusLabel,
  isSyncableTaskStatus
} from "@/lib/task-rules";

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

type AttachmentPreviewModal = {
  attachment: UploadedAttachment;
  title: string;
  kind: "image" | "text" | "unsupported";
  content?: string;
  url?: string;
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
type IconName =
  | "logo"
  | "plus"
  | "activity"
  | "rules"
  | "work"
  | "logout"
  | "sidebarCollapse"
  | "sidebarExpand"
  | "menu"
  | "close"
  | "chevron"
  | "attachment"
  | "download"
  | "user";

const MAX_ATTACHMENTS = 5;
const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024;
const MIN_DESCRIPTION_LENGTH = 10;
const DESCRIPTION_TOO_SHORT_ERROR = "请输入10个字以上的需求描述";
const PENDING_PAYMENT_TASK_STORAGE_KEY = "pendingPaymentTaskId";
const SUBMISSION_READ_COUNTS_STORAGE_KEY = "aichong:submission-read-counts:v2";
const IMAGE_FILE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "gif", "webp", "avif", "svg"]);
const VIDEO_FILE_EXTENSIONS = new Set(["mp4", "mov", "webm", "m4v", "avi"]);
const AUDIO_FILE_EXTENSIONS = new Set(["mp3", "wav", "m4a", "aac", "ogg", "flac"]);
const DOCUMENT_FILE_EXTENSIONS = new Set(["pdf", "doc", "docx", "txt", "md", "ppt", "pptx", "xls", "xlsx", "csv"]);
const ARCHIVE_FILE_EXTENSIONS = new Set(["zip", "rar", "7z", "tar", "gz"]);
const isPhoneValid = (phone: string) => /^1\d{10}$/.test(phone);
const isCodeValid = (code: string) => /^\d{6}$/.test(code);
const maskPhone = (phone: string) => {
  const digits = phone.replace(/\D/g, "");
  if (digits.length !== 11) {
    return phone;
  }
  return `${digits.slice(0, 3)}****${digits.slice(-4)}`;
};
const getSubmissionCount = (task: PublishTask) => task.submissionCount || 0;
const getSidebarStatusClassName = (status: string) => {
  if (status === "ACTIVE") {
    return "is-active";
  }
  if (status === "PENDING_SELECTION") {
    return "is-selection";
  }
  return "";
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
    type: "文案",
    title: "文案写作",
    request: "从工作总结、社交图文，到旅游攻略、高情商回复等，全场景文字需求都能代笔。",
    iconSrc: "/icons/case-copy.svg"
  },
  {
    type: "图片",
    title: "图像设计",
    request: "从品牌Logo、电商主图，到老照片修复、头像定制等，满足各类图像处理委托。",
    iconSrc: "/icons/case-image.svg"
  },
  {
    type: "声音",
    title: "音频制作",
    request: "从人声配音、背景音乐，到音频降噪、专属生日歌等，提供专业的声音制作服务。",
    iconSrc: "/icons/case-music.svg"
  },
  {
    type: "视频",
    title: "视频创作",
    request: "从短视频混剪、数字人播报，到Vlog粗剪、字幕压制等，搞定各类繁琐视频任务。",
    iconSrc: "/icons/case-video.svg"
  }
];

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

  if (name === "sidebarCollapse") {
    return (
      <svg aria-hidden="true" className="ui-icon" fill="none" viewBox="0 0 24 24">
        <path d="M13.5 14.5L11.5 12L13.5 9.5M11.5 12H17" stroke="currentColor" />
        <path
          d="M20.5 18.5V5.5C20.5 4.39543 19.6046 3.5 18.5 3.5H5.5C4.39543 3.5 3.5 4.39543 3.5 5.5V18.5C3.5 19.6046 4.39543 20.5 5.5 20.5H18.5C19.6046 20.5 20.5 19.6046 20.5 18.5Z"
          stroke="currentColor"
          strokeLinecap="round"
        />
        <path d="M8.5 3.5V20.5" stroke="currentColor" strokeLinecap="round" />
      </svg>
    );
  }

  if (name === "sidebarExpand") {
    return (
      <svg aria-hidden="true" className="ui-icon" fill="none" viewBox="0 0 24 24">
        <path d="M15 14.5L17 12L15 9.5M17 12H11.5" stroke="currentColor" />
        <path
          d="M20.5 18.5V5.5C20.5 4.39543 19.6046 3.5 18.5 3.5H5.5C4.39543 3.5 3.5 4.39543 3.5 5.5V18.5C3.5 19.6046 4.39543 20.5 5.5 20.5H18.5C19.6046 20.5 20.5 19.6046 20.5 18.5Z"
          stroke="currentColor"
          strokeLinecap="round"
        />
        <path d="M8.5 3.5V20.5" stroke="currentColor" strokeLinecap="round" />
      </svg>
    );
  }

  if (name === "menu") {
    return (
      <svg aria-hidden="true" className="ui-icon" fill="none" viewBox="0 0 24 24">
        <path d="M5 7H19" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
        <path d="M5 12H19" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
        <path d="M5 17H19" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
      </svg>
    );
  }

  if (name === "close") {
    return (
      <svg aria-hidden="true" className="ui-icon" fill="none" viewBox="0 0 24 24">
        <path d="M18 6L6 18" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
        <path d="M6 6L18 18" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
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

  if (name === "download") {
    return (
      <svg {...commonProps}>
        <path d="M12 4v10" />
        <path d="M8 10l4 4 4-4" />
        <path d="M5 20h14" />
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

function addHoursToDateTime(value: string | undefined, hours: number) {
  if (!value) return "";
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  date.setHours(date.getHours() + hours);
  return date.toISOString();
}

function formatFileSize(bytes?: number) {
  if (!bytes || bytes <= 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function getAttachmentDisplayName(index: number) {
  return `附件${index + 1}`;
}

const cp1252ReverseMap: Record<string, number> = {
  "\u20AC": 0x80,
  "\u201A": 0x82,
  "\u0192": 0x83,
  "\u201E": 0x84,
  "\u2026": 0x85,
  "\u2020": 0x86,
  "\u2021": 0x87,
  "\u02C6": 0x88,
  "\u2030": 0x89,
  "\u0160": 0x8a,
  "\u2039": 0x8b,
  "\u0152": 0x8c,
  "\u017D": 0x8e,
  "\u2018": 0x91,
  "\u2019": 0x92,
  "\u201C": 0x93,
  "\u201D": 0x94,
  "\u2022": 0x95,
  "\u2013": 0x96,
  "\u2014": 0x97,
  "\u02DC": 0x98,
  "\u2122": 0x99,
  "\u0161": 0x9a,
  "\u203A": 0x9b,
  "\u0153": 0x9c,
  "\u017E": 0x9e,
  "\u0178": 0x9f
};

function repairMojibakeFileName(fileName: string) {
  const trimmedName = fileName.trim();
  const percentDecoded = /%[0-9a-f]{2}/i.test(trimmedName)
    ? (() => {
        try {
          return decodeURIComponent(trimmedName);
        } catch {
          return trimmedName;
        }
      })()
    : trimmedName;

  if (/[\u4e00-\u9fff]/.test(percentDecoded)) {
    return percentDecoded;
  }

  const looksMojibake = /[ÃÂ]|[æåçèäöü][\u0080-\uFFFF]?|[\u201A-\u201E\u2020-\u2022\u02C6\u02DC\u2030\u2039\u203A]/.test(percentDecoded);
  if (!looksMojibake) {
    return percentDecoded;
  }

  const bytes: number[] = [];
  for (const char of percentDecoded) {
    const code = char.charCodeAt(0);
    const mappedByte = cp1252ReverseMap[char];

    if (mappedByte) {
      bytes.push(mappedByte);
    } else if (code <= 0xff) {
      bytes.push(code);
    } else {
      return percentDecoded;
    }
  }

  try {
    const decoded = new TextDecoder("utf-8", { fatal: true }).decode(new Uint8Array(bytes));
    return /[\u4e00-\u9fff]/.test(decoded) ? decoded : percentDecoded;
  } catch {
    return percentDecoded;
  }
}

function getAttachmentOriginalName(attachment: { fileName?: string }, index: number) {
  return attachment.fileName?.trim() ? repairMojibakeFileName(attachment.fileName) : getAttachmentDisplayName(index);
}

function getFileExtension(fileName?: string) {
  const normalizedName = fileName ? repairMojibakeFileName(fileName) : "";
  const extension = normalizedName.split(".").pop()?.trim().toLowerCase();
  return extension && extension !== normalizedName.toLowerCase() ? extension : "";
}

function getAttachmentKind(attachment: { fileName?: string; mimeType?: string }) {
  const mimeType = attachment.mimeType || "";
  const extension = getFileExtension(attachment.fileName);

  if (mimeType.startsWith("image/") || IMAGE_FILE_EXTENSIONS.has(extension)) return "image";
  if (mimeType.startsWith("video/") || VIDEO_FILE_EXTENSIONS.has(extension)) return "video";
  if (mimeType.startsWith("audio/") || AUDIO_FILE_EXTENSIONS.has(extension)) return "audio";
  if (DOCUMENT_FILE_EXTENSIONS.has(extension)) return "doc";
  if (ARCHIVE_FILE_EXTENSIONS.has(extension)) return "archive";
  return "file";
}

function getAttachmentTypeLabel(attachment: { fileName?: string; mimeType?: string }) {
  const extension = getFileExtension(attachment.fileName);
  if (extension) return extension.slice(0, 4).toUpperCase();

  const kind = getAttachmentKind(attachment);
  if (kind === "image") return "IMG";
  if (kind === "video") return "VID";
  if (kind === "audio") return "AUD";
  if (kind === "doc") return "DOC";
  if (kind === "archive") return "ZIP";
  return "FILE";
}

function getAttachmentDownloadUrl(attachment: { fileUrl: string; fileName?: string }, disposition: "attachment" | "inline" = "attachment") {
  const params = new URLSearchParams({
    url: attachment.fileUrl,
    filename: attachment.fileName || "submission-attachment",
    disposition
  });
  return `/api/download/submission-attachment?${params.toString()}`;
}

function AttachmentVisual({ attachment, file }: { attachment: { fileUrl?: string; fileName?: string; mimeType?: string }; file?: File }) {
  const [localImageUrl, setLocalImageUrl] = useState<string | null>(null);
  const kind = getAttachmentKind(attachment);
  const isImage = kind === "image";

  useEffect(() => {
    if (!file || !isImage) {
      setLocalImageUrl(null);
      return;
    }

    const nextUrl = URL.createObjectURL(file);
    setLocalImageUrl(nextUrl);
    return () => URL.revokeObjectURL(nextUrl);
  }, [file, isImage]);

  const imageUrl = isImage
    ? localImageUrl || (attachment.fileUrl ? getAttachmentDownloadUrl({ fileUrl: attachment.fileUrl, fileName: attachment.fileName }, "inline") : "")
    : "";

  if (imageUrl) {
    return (
      <span className="attachment-thumb image" aria-hidden="true">
        <img src={imageUrl} alt="" />
      </span>
    );
  }

  return (
    <span className={`attachment-thumb ${kind}`} aria-hidden="true">
      <span>{getAttachmentTypeLabel(attachment)}</span>
    </span>
  );
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

function isImageLikeAttachment(fileName?: string, contentType = "") {
  const normalizedName = (fileName || "").toLowerCase();
  return (
    contentType.includes("image/") ||
    normalizedName.endsWith(".png") ||
    normalizedName.endsWith(".jpg") ||
    normalizedName.endsWith(".jpeg") ||
    normalizedName.endsWith(".gif") ||
    normalizedName.endsWith(".webp")
  );
}

function getDisplayTaskDescription(description: string) {
  return description
    .replace(/^真实接口联调测试：?/, "")
    .replace(/^真实接口测试订单：?/, "测试任务：")
    .replace("这是平台联调使用的小额测试任务。", "这是一条小额测试任务。");
}

function isSyncableTask(task: PublishTask) {
  return isSyncableTaskStatus(task.status);
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
  const [hasLoadedTasks, setHasLoadedTasks] = useState(false);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isRefreshingPayment, setIsRefreshingPayment] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isConfirmingPayment, setIsConfirmingPayment] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [codeCooldown, setCodeCooldown] = useState(0);
  const [uploadProgressText, setUploadProgressText] = useState<string | null>(null);
  const [selectingSubmissionId, setSelectingSubmissionId] = useState<string | null>(null);
  const [attachmentPreviewModal, setAttachmentPreviewModal] = useState<AttachmentPreviewModal | null>(null);
  const [previewLoadingUrl, setPreviewLoadingUrl] = useState<string | null>(null);
  const [downloadingAttachmentUrl, setDownloadingAttachmentUrl] = useState<string | null>(null);
  const [taskFilter, setTaskFilter] = useState<TaskFilter>("all");
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const [isSubmissionsCollapsed, setIsSubmissionsCollapsed] = useState(false);
  const [pendingPaymentTaskId, setPendingPaymentTaskId] = useState<string | null>(null);
  const [pendingPaymentUrl, setPendingPaymentUrl] = useState<string | null>(null);
  const [lastRefreshAt, setLastRefreshAt] = useState<string | null>(null);
  const [readSubmissionCounts, setReadSubmissionCounts] = useState<Record<string, number>>({});
  const [composerAttachmentScroll, setComposerAttachmentScroll] = useState({ canScrollLeft: false, canScrollRight: false });
  const composerAttachmentsRef = useRef<HTMLDivElement | null>(null);
  const filterMenuRef = useRef<HTMLElement | null>(null);
  const accountMenuRef = useRef<HTMLDivElement | null>(null);
  const shouldPublishAfterLoginRef = useRef(false);
  const canLogin = isPhoneValid(loginPhone) && isCodeValid(loginCode) && !isLoggingIn;
  const canSendCode = isPhoneValid(loginPhone) && !isSendingCode && codeCooldown === 0;
  const isPhoneLoggedIn = currentUser?.authMode === "phone";
  const isPublishDisabled = isCreating || description.trim().length === 0;
  const shouldShowDescriptionError = error === DESCRIPTION_TOO_SHORT_ERROR;
  const descriptionLength = description.trim().length;
  const visibleTasks = tasks.filter((task) => task.status !== "PENDING_PAYMENT");
  const filteredTasks = visibleTasks.filter((task) => taskFilter === "all" || task.status === taskFilter);
  const shouldShowSidebarOrders = Boolean(isPhoneLoggedIn && hasLoadedTasks && visibleTasks.length > 0);
  const hasCurrentUserSyncableTasks = tasks.some(isSyncableTask);

  function getSubmissionReadStorageKey() {
    return SUBMISSION_READ_COUNTS_STORAGE_KEY;
  }

  function saveReadSubmissionCounts(nextCounts: Record<string, number>) {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(getSubmissionReadStorageKey(), JSON.stringify(nextCounts));
  }

  function initializeSubmissionReadCountsIfNeeded(nextTasks: PublishTask[]) {
    if (typeof window === "undefined") {
      return;
    }

    const storageKey = getSubmissionReadStorageKey();
    if (window.localStorage.getItem(storageKey) !== null) {
      return;
    }

    const initialCounts = nextTasks.reduce<Record<string, number>>((counts, task) => {
      const submissionCount = getSubmissionCount(task);
      if (submissionCount > 0) {
        counts[task.taskId] = submissionCount;
      }
      return counts;
    }, {});

    window.localStorage.setItem(storageKey, JSON.stringify(initialCounts));
    setReadSubmissionCounts(initialCounts);
  }

  function markTaskSubmissionsRead(taskId: string, count?: number) {
    const nextCount =
      count ??
      getSubmissionCount(tasks.find((task) => task.taskId === taskId) || selectedTask || ({ submissionCount: 0 } as PublishTask));

    if (nextCount <= 0) {
      return;
    }

    setReadSubmissionCounts((currentCounts) => {
      if ((currentCounts[taskId] || 0) >= nextCount) {
        return currentCounts;
      }

      const nextCounts = {
        ...currentCounts,
        [taskId]: nextCount
      };
      saveReadSubmissionCounts(nextCounts);
      return nextCounts;
    });
  }

  function hasUnreadSubmissions(task: PublishTask) {
    return getUnreadSubmissionCount(task) > 0;
  }

  function getUnreadSubmissionCount(task: PublishTask) {
    const submissionCount = getSubmissionCount(task);
    return Math.max(0, submissionCount - (readSubmissionCounts[task.taskId] || 0));
  }

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

  function scrollComposerAttachments(direction: "left" | "right") {
    const list = composerAttachmentsRef.current;
    if (!list) return;

    list.scrollBy({
      left: direction === "left" ? -240 : 240,
      behavior: "smooth"
    });
  }

  function updateComposerAttachmentScrollState() {
    const list = composerAttachmentsRef.current;
    if (!list) {
      setComposerAttachmentScroll({ canScrollLeft: false, canScrollRight: false });
      return;
    }

    const maxScrollLeft = list.scrollWidth - list.clientWidth;
    const canScroll = maxScrollLeft > 2;
    const canScrollLeft = canScroll && list.scrollLeft > 2;
    const canScrollRight = canScroll && list.scrollLeft < maxScrollLeft - 2;

    setComposerAttachmentScroll((current) =>
      current.canScrollLeft === canScrollLeft && current.canScrollRight === canScrollRight
        ? current
        : { canScrollLeft, canScrollRight }
    );
  }

  async function loadTasks() {
    setIsLoading(true);
    setError(null);

    try {
      const data = await readJson<{ tasks: PublishTask[]; source?: "mock" | "caichong" | "supabase" }>(
        await fetch("/api/tasks?page=1&pageSize=20")
      );
      const nextTasks = data.tasks || [];
      setTasks(nextTasks);
      initializeSubmissionReadCountsIfNeeded(nextTasks);
      setDataSource(data.source || "unknown");
      setLastRefreshAt(new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }));
      return nextTasks;

    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "订单读取失败");
      return [];
    } finally {
      setIsLoading(false);
      setHasLoadedTasks(true);
    }
  }

  async function loadCurrentUser() {
    setIsAuthLoading(true);
    try {
      const user = await readJson<CurrentUser>(await fetch("/api/me"));
      setCurrentUser(user);
    } catch {
      setCurrentUser(null);
    } finally {
      setIsAuthLoading(false);
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
        const nextSubmissions = Array.isArray(submissionData) ? submissionData : submissionData.submissions || [];
        setSubmissions(nextSubmissions);
        markTaskSubmissionsRead(taskId, Math.max(getSubmissionCount(task), nextSubmissions.length));
      } catch {
        setSubmissions([]);
        markTaskSubmissionsRead(taskId, getSubmissionCount(task));
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
      return data.paymentUrl;
    } catch (paymentError) {
      setError(paymentError instanceof Error ? paymentError.message : "付款入口刷新失败");
      return null;
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
      setUploadProgressText(`正在上传附件 ${index + 1}/${attachments.length}`);
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

  async function openAttachmentPreview(attachment: UploadedAttachment, title = "附件预览") {
    setPreviewLoadingUrl(attachment.fileUrl);
    setError(null);

    try {
      const previewUrl = getAttachmentDownloadUrl(attachment, "inline");
      const response = await fetch(previewUrl);
      if (!response.ok) {
        throw new Error("附件预览失败");
      }

      const contentType = response.headers.get("content-type") || "";
      if (isImageLikeAttachment(attachment.fileName, contentType)) {
        setAttachmentPreviewModal({
          attachment,
          title,
          kind: "image",
          url: previewUrl
        });
        return;
      }

      if (isTextLikeAttachment(attachment.fileName, contentType)) {
        const text = await response.text();
        setAttachmentPreviewModal({
          attachment,
          title,
          kind: "text",
          content: text || "文件内容为空。"
        });
        return;
      }

      setAttachmentPreviewModal({
        attachment,
        title,
        kind: "unsupported",
        content: "这个附件暂时不能在线预览，请下载后查看。"
      });
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
      setMessage("已触发下载。");
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

  async function confirmPaymentComplete() {
    if (!pendingPaymentTaskId) {
      return;
    }

    setIsConfirmingPayment(true);
    setMessage(null);
    setError(null);

    try {
      await readJson<{ checkedEvents: number; messages: string[] }>(
        await fetch("/api/sync/heartbeat", {
          method: "POST"
        })
      );

      const nextTasks = await loadTasks();
      const paidTask = nextTasks.find((task) => task.taskId === pendingPaymentTaskId && task.status !== "PENDING_PAYMENT");

      if (!paidTask) {
        setMessage("暂时还没有检测到付款完成，请稍后再试。");
        return;
      }

      window.sessionStorage.removeItem(PENDING_PAYMENT_TASK_STORAGE_KEY);
      setPendingPaymentTaskId(null);
      setPendingPaymentUrl(null);
      setMessage("付款已完成，任务已发布。");
      updateSelectedTask(paidTask.taskId);
    } catch (confirmError) {
      setError(confirmError instanceof Error ? confirmError.message : "付款状态刷新失败");
    } finally {
      setIsConfirmingPayment(false);
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

      setTasks([]);
      setHasLoadedTasks(false);
      setCurrentUser(user);
      setIsAuthLoading(false);
      setMessage(null);
      setIsLoginOpen(false);
      const shouldPublishAfterLogin = shouldPublishAfterLoginRef.current;
      shouldPublishAfterLoginRef.current = false;

      if (shouldPublishAfterLogin) {
        await publishTask();
      } else {
        await loadTasks();
      }
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
    setTasks([]);
    setHasLoadedTasks(false);
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

  function updatePriceInput(value: string) {
    const normalizedValue = value
      .replace(/[^\d.]/g, "")
      .replace(/^(\d*\.?)|(\.)/g, (_match, firstDot) => firstDot || "")
      .replace(/^(\d+)(\.\d?).*$/, "$1$2");

    if (!normalizedValue || normalizedValue === ".") {
      setPrice("");
      return;
    }

    const numericValue = Number(normalizedValue);
    if (Number.isFinite(numericValue) && numericValue > 100) {
      setPrice("100");
      return;
    }

    setPrice(normalizedValue);
  }

  function normalizePriceInput() {
    const numericPrice = Number(price);
    if (!Number.isFinite(numericPrice) || numericPrice < 1) {
      setPrice("1");
      return;
    }

    if (numericPrice > 100) {
      setPrice("100");
      return;
    }

    setPrice(Number.isInteger(numericPrice) ? String(numericPrice) : numericPrice.toFixed(1));
  }

  async function createTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isPhoneLoggedIn) {
      shouldPublishAfterLoginRef.current = true;
      setError(null);
      setMessage(null);
      setIsLoginOpen(true);
      return;
    }

    await publishTask();
  }

  async function publishTask() {
    const trimmedDescription = description.trim();
    const numericPrice = Number(price);

    if (trimmedDescription.length < MIN_DESCRIPTION_LENGTH) {
      setError(DESCRIPTION_TOO_SHORT_ERROR);
      return;
    }

    if (!Number.isFinite(numericPrice) || numericPrice < 1 || numericPrice > 100) {
      setError("请输入1-100元的报酬");
      return;
    }

    let paymentWindow: Window | null = null;
    try {
      paymentWindow = window.open("", "_blank");
      paymentWindow?.document.write("<title>正在打开付款页面</title><p style=\"font-family: sans-serif; padding: 24px;\">正在打开付款页面...</p>");
    } catch {
      paymentWindow = null;
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

      let paymentUrl = task.paymentUrl;
      if (!paymentUrl) {
        paymentUrl = (await refreshPaymentUrl(task.taskId)) || undefined;
      }

      if (!paymentUrl) {
        throw new Error("任务已创建，但付款页面暂时没有打开，请稍后刷新页面重试。");
      }

      window.sessionStorage.setItem(PENDING_PAYMENT_TASK_STORAGE_KEY, task.taskId);
      updateSelectedTask(null);
      setSelectedTask(null);
      setSubmissions([]);
      setPendingPaymentTaskId(task.taskId);
      setPendingPaymentUrl(paymentUrl);
      setMessage("任务已创建，付款页面已打开。完成付款后请回到这里查看任务。");
      setDescription("");
      setAttachments([]);
      await loadTasks();
      if (paymentWindow) {
        paymentWindow.location.href = paymentUrl;
      } else {
        window.open(paymentUrl, "_blank", "noopener,noreferrer");
      }
    } catch (createError) {
      paymentWindow?.close();
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
    if (typeof window === "undefined") {
      return;
    }

    try {
      const storedCounts = window.localStorage.getItem(getSubmissionReadStorageKey());
      setReadSubmissionCounts(storedCounts ? (JSON.parse(storedCounts) as Record<string, number>) : {});
    } catch {
      setReadSubmissionCounts({});
    }
  }, []);

  useEffect(() => {
    const taskIdFromUrl = new URLSearchParams(window.location.search).get("task");
    if (taskIdFromUrl) {
      setSelectedTaskId(taskIdFromUrl);
    }
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(updateComposerAttachmentScrollState);
    return () => window.cancelAnimationFrame(frame);
  }, [attachments.length]);

  useEffect(() => {
    window.addEventListener("resize", updateComposerAttachmentScrollState);
    return () => window.removeEventListener("resize", updateComposerAttachmentScrollState);
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
    if (typeof window === "undefined" || selectedTaskId) {
      return;
    }

    const pendingTaskId = window.sessionStorage.getItem(PENDING_PAYMENT_TASK_STORAGE_KEY);
    if (!pendingTaskId) {
      return;
    }

    const paidTask = visibleTasks.find((task) => task.taskId === pendingTaskId);
    if (!paidTask) {
      return;
    }

    window.sessionStorage.removeItem(PENDING_PAYMENT_TASK_STORAGE_KEY);
    setPendingPaymentTaskId(null);
    setPendingPaymentUrl(null);
    updateSelectedTask(pendingTaskId);
  }, [selectedTaskId, visibleTasks]);

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
    <main className={`studio-shell ${!selectedTaskId ? "home-active" : "detail-active"} ${isSidebarCollapsed ? "sidebar-collapsed" : ""}`}>
      <button
        aria-label="打开菜单"
        className="mobile-menu-button"
        type="button"
        onClick={() => setIsMenuOpen(true)}
      >
        <Icon name="menu" />
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
              <strong>AICHONG</strong>
            </span>
          </Link>
          <button
            aria-label={isSidebarCollapsed ? "展开侧栏" : "收起侧栏"}
            className="sidebar-collapse-button"
            type="button"
            onClick={() => setIsSidebarCollapsed((collapsed) => !collapsed)}
          >
            <Icon name={isSidebarCollapsed ? "sidebarExpand" : "sidebarCollapse"} />
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
            <span className="sidebar-label">发布新任务</span>
          </button>
        </nav>

        {shouldShowSidebarOrders ? (
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
              {filteredTasks.map((task) => (
                  <button
                    className={`sidebar-task ${selectedTaskId === task.taskId ? "active" : ""}`}
                    key={task.taskId}
                    onClick={() => {
                      markTaskSubmissionsRead(task.taskId);
                      updateSelectedTask(task.taskId);
                      setIsMenuOpen(false);
                    }}
                    type="button"
                  >
                    <span className="sidebar-task-title">{getDisplayTaskDescription(task.description)}</span>
                    <span className="sidebar-task-meta">
                      <span className="sidebar-task-submission-count" title={`${getSubmissionCount(task)} 接单`}>
                        {getSubmissionCount(task)}
                      </span>
                      <span className={`sidebar-task-status ${getSidebarStatusClassName(task.status)}`}>
                        {getTaskStatusLabel(task.status)}
                        {hasUnreadSubmissions(task) ? (
                          <span className="sidebar-task-unread-dot" aria-label={`${getUnreadSubmissionCount(task)} 条新投稿`}>
                            {getUnreadSubmissionCount(task) > 9 ? "9+" : getUnreadSubmissionCount(task)}
                          </span>
                        ) : null}
                      </span>
                    </span>
                  </button>
                ))}
            </div>
          </section>
        ) : (
          <div className="sidebar-orders-placeholder" aria-hidden="true" />
        )}

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
                <span className="sidebar-label">{maskPhone(currentUser.phone)}</span>
                <span className={`account-chevron ${isAccountMenuOpen ? "open" : ""}`}>
                  <Icon name="chevron" />
                </span>
              </button>
            </div>
          ) : null}
        </section>
      </aside>

      {!isAuthLoading && !isPhoneLoggedIn ? (
        <button className="studio-login-button" type="button" onClick={() => setIsLoginOpen((open) => !open)}>
          登录/注册
        </button>
      ) : null}

      {isLoginOpen && !isPhoneLoggedIn ? (
        <div className="modal-layer">
          <button className="modal-backdrop login-backdrop" aria-label="关闭登录弹窗" type="button" onClick={() => setIsLoginOpen(false)} />
          <section className="login-modal" role="dialog" aria-modal="true" aria-labelledby="login-title">
            <div className="modal-header">
              <div>
                <h2 id="login-title">登录/注册</h2>
                <p>登录后可以发布任务、查看投稿和历史任务。</p>
              </div>
              <button aria-label="关闭登录弹窗" type="button" onClick={() => setIsLoginOpen(false)}>
                <Icon name="close" />
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

      {attachmentPreviewModal ? (
        <div className="modal-layer">
          <button className="modal-backdrop preview-backdrop" aria-label="关闭附件预览" type="button" onClick={() => setAttachmentPreviewModal(null)} />
          <section className="attachment-preview-modal" role="dialog" aria-modal="true" aria-label="附件预览">
            <div className="modal-header">
              <div>
                <h2>附件预览</h2>
                {attachmentPreviewModal.attachment.fileSize ? <p>{formatFileSize(attachmentPreviewModal.attachment.fileSize)}</p> : null}
              </div>
              <button aria-label="关闭附件预览" type="button" onClick={() => setAttachmentPreviewModal(null)}>
                <Icon name="close" />
              </button>
            </div>
            <div className="attachment-preview-modal-body">
              {attachmentPreviewModal.kind === "image" && attachmentPreviewModal.url ? (
                <img src={attachmentPreviewModal.url} alt="附件预览" />
              ) : null}
              {attachmentPreviewModal.kind === "text" ? <pre>{attachmentPreviewModal.content}</pre> : null}
              {attachmentPreviewModal.kind === "unsupported" ? <p>{attachmentPreviewModal.content}</p> : null}
            </div>
            <div className="attachment-preview-modal-actions">
              <button type="button" onClick={() => downloadAttachment(attachmentPreviewModal.attachment)}>
                <Icon name="download" />
                下载附件
              </button>
            </div>
          </section>
        </div>
      ) : null}

      <section className="studio-content">
        {!selectedTaskId ? (
          <div className="studio-home">
            <section className="home-entry-panel">
              <div className="home-hero-intro">
                <h1>今天想做点什么？</h1>
              </div>

              <form className="hero-task-card studio-composer home-composer" onSubmit={createTask} noValidate>
                <div className="form-body">
                  {attachments.length > 0 ? (
                    <div
                      className={`composer-attachments-wrap ${composerAttachmentScroll.canScrollLeft ? "has-left-button" : ""} ${
                        composerAttachmentScroll.canScrollRight ? "has-right-button" : ""
                      }`}
                    >
                      {composerAttachmentScroll.canScrollLeft ? (
                        <button
                          className="composer-attachment-scroll-button left"
                          aria-label="向左滚动附件"
                          title="向左"
                          type="button"
                          onClick={() => scrollComposerAttachments("left")}
                        >
                          <Icon name="chevron" />
                        </button>
                      ) : null}
                      <div
                        className="attachment-list composer-attachments"
                        ref={composerAttachmentsRef}
                        onScroll={updateComposerAttachmentScrollState}
                      >
                        {attachments.map((attachment, index) => (
                          <div className="attachment-item is-removable" key={`${attachment.fileName}-${index}`}>
                            <AttachmentVisual attachment={attachment} file={attachment.file} />
                            <div className="attachment-copy">
                              <strong title={repairMojibakeFileName(attachment.fileName)}>{repairMojibakeFileName(attachment.fileName)}</strong>
                              <span>{formatFileSize(attachment.fileSize)}</span>
                            </div>
                            <button
                              className="attachment-remove-button"
                              aria-label={`删除 ${attachment.fileName}`}
                              title="删除"
                              type="button"
                              onClick={() => removeAttachment(index)}
                            >
                              <Icon name="close" />
                            </button>
                          </div>
                        ))}
                      </div>
                      {composerAttachmentScroll.canScrollRight ? (
                        <button
                          className="composer-attachment-scroll-button right"
                          aria-label="向右滚动附件"
                          title="向右"
                          type="button"
                          onClick={() => scrollComposerAttachments("right")}
                        >
                          <Icon name="chevron" />
                        </button>
                      ) : null}
                    </div>
                  ) : null}

                  <label className="textarea-field" htmlFor="description">
                    <textarea
                      id="description"
                      aria-label="任务说明"
                      value={description}
                      onChange={(event) => {
                        const nextDescription = event.target.value;
                        setDescription(nextDescription);
                        if (error === DESCRIPTION_TOO_SHORT_ERROR && nextDescription.trim().length >= MIN_DESCRIPTION_LENGTH) {
                          setError(null);
                        }
                      }}
                      placeholder="说说你想做什么，比如风格、要求、字数、时长或用在什么场景等，描述越具体，成果越符合预期"
                      disabled={isCreating}
                    />
                  </label>

                  <div className="task-card-controls">
                    <label
                      className="attachment-control"
                      htmlFor="attachments"
                      aria-label="上传附件"
                      onClick={(event) => {
                        if (!isPhoneLoggedIn) {
                          event.preventDefault();
                          setError(null);
                          setMessage(null);
                          setIsLoginOpen(true);
                        }
                      }}
                    >
                      <Icon name="attachment" />
                      <input
                        id="attachments"
                        multiple
                        type="file"
                        disabled={isCreating}
                        onClick={(event) => {
                          if (!isPhoneLoggedIn) {
                            event.preventDefault();
                            event.stopPropagation();
                            setError(null);
                            setMessage(null);
                            setIsLoginOpen(true);
                          }
                        }}
                        onChange={(event) => {
                          if (!isPhoneLoggedIn) {
                            event.target.value = "";
                            setError(null);
                            setMessage(null);
                            setIsLoginOpen(true);
                            return;
                          }
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
                        step="0.1"
                        type="text"
                        value={price}
                        onBlur={normalizePriceInput}
                        onChange={(event) => updatePriceInput(event.target.value)}
                        disabled={isCreating}
                      />
                    </label>
                    <button className="publish-button" type="submit" disabled={isPublishDisabled}>
                      {isCreating ? "发布中" : "发布任务 →"}
                    </button>
                  </div>

                  {pendingPaymentTaskId && pendingPaymentUrl ? (
                    <div className="payment-wait-card">
                      <div>
                        <strong>请先完成付款</strong>
                        <span>付款完成后回到这里，刷新状态即可看到任务详情。</span>
                      </div>
                      <div className="payment-wait-actions">
                        <a href={pendingPaymentUrl} target="_blank" rel="noreferrer">
                          重新打开付款页
                        </a>
                        <button type="button" onClick={confirmPaymentComplete} disabled={isConfirmingPayment}>
                          {isConfirmingPayment ? "刷新中" : "我已完成付款"}
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {uploadProgressText ? <div className="message neutral">{uploadProgressText}</div> : null}
                  {message ? <div className="message neutral">{message}</div> : null}
                  {error && !shouldShowDescriptionError ? <div className="message error">{error}</div> : null}
                </div>
              </form>
              {shouldShowDescriptionError ? <div className="composer-validation-message">{DESCRIPTION_TOO_SHORT_ERROR}</div> : null}
            </section>

            <section className="case-section studio-cases">
              <div className="case-grid">
                {exampleCases.map((item) => (
                  <article className="case-card" key={item.type}>
                    <span className="case-icon" aria-hidden="true">
                      <img src={item.iconSrc} alt="" />
                    </span>
                    <h3>{item.title}</h3>
                    <p>{item.request}</p>
                  </article>
                ))}
              </div>
            </section>
          </div>
        ) : (
          <section className="detail-stage">
              <div className="content-body">
                {isDetailLoading ? (
                  <div className="empty-state">正在读取任务详情和交付结果...</div>
                ) : selectedTask ? (
                  <div className="detail-stack">
                    <div className="detail-floating-bar">
                      {lastRefreshAt ? <span className="detail-refresh-meta">上次刷新 {lastRefreshAt}</span> : null}
                      <button
                        className="detail-refresh-button"
                        aria-label="刷新"
                        data-tooltip="刷新"
                        title="刷新"
                        type="button"
                        onClick={() => loadTaskDetail(selectedTask.taskId)}
                        disabled={isDetailLoading}
                      >
                        <Icon name="activity" />
                      </button>
                    </div>

                    <div className="detail-card task-detail-card">
                      <div className="section-eyebrow">任务详情</div>
                      <div className="task-topline">
                        <h4 className="detail-title">{getDisplayTaskDescription(selectedTask.description)}</h4>
                        <span className="money">¥{selectedTask.price}</span>
                      </div>
                      <div className="task-detail-meta-line">
                        <span className="chip">{getTaskStatusLabel(selectedTask.status)}</span>
                        <span className="chip">{selectedTask.submissionCount || 0} 投稿</span>
                        {selectedTask.status === "PENDING_PAYMENT" && selectedTask.createdAt ? (
                          <>
                            <span className="task-detail-time-text">创建时间 {formatDateTimeToMinute(selectedTask.createdAt)}</span>
                            <span className="task-detail-time-text">付款截止 {formatDateTimeToMinute(addHoursToDateTime(selectedTask.createdAt, 24))}</span>
                            <span className="task-detail-time-text">支付链接有效 30 分钟，可刷新</span>
                          </>
                        ) : null}
                        {selectedTask.status === "ACTIVE" && (selectedTask.paidAt || selectedTask.createdAt) ? (
                          <span className="task-detail-time-text">发布时间 {formatDateTimeToMinute(selectedTask.paidAt || selectedTask.createdAt)}</span>
                        ) : null}
                        {selectedTask.status === "ACTIVE" && selectedTask.deadlineAt ? (
                          <span className="task-detail-time-text">提交期结束 {formatDateTimeToMinute(selectedTask.deadlineAt)}</span>
                        ) : null}
                        {selectedTask.status === "PENDING_SELECTION" && selectedTask.deadlineAt ? (
                          <span className="selection-deadline-warning">
                            请在 {formatDateTimeToMinute(selectedTask.deadlineAt)} 前选定投稿，超时将自动退款。
                          </span>
                        ) : null}
                        {selectedTask.status === "COMPLETED" && selectedTask.updatedAt ? (
                          <span className="task-detail-time-text">完成时间 {formatDateTimeToMinute(selectedTask.updatedAt)}</span>
                        ) : null}
                        {selectedTask.status === "CLOSED" && selectedTask.closeReason ? (
                          <span className="task-detail-time-text">{getCloseReasonLabel(selectedTask.closeReason)}</span>
                        ) : null}
                      </div>

                      {selectedTask.attachments?.length ? (
                        <div className="task-attachment-section">
                          <div className="attachment-list compact-list">
                            {selectedTask.attachments.map((attachment, index) => (
                              <div
                                className="attachment-item linked attachment-row"
                                key={`${attachment.fileUrl}-${index}`}
                                role="button"
                                tabIndex={0}
                                title="点击预览"
                                onClick={() => openAttachmentPreview(attachment, getAttachmentOriginalName(attachment, index))}
                                onKeyDown={(event) => {
                                  if (event.key === "Enter" || event.key === " ") {
                                    event.preventDefault();
                                    openAttachmentPreview(attachment, getAttachmentOriginalName(attachment, index));
                                  }
                                }}
                              >
                                <AttachmentVisual attachment={attachment} />
                                <div className="attachment-copy">
                                  <strong title={getAttachmentOriginalName(attachment, index)}>{getAttachmentOriginalName(attachment, index)}</strong>
                                  {attachment.fileSize ? <span>{formatFileSize(attachment.fileSize)}</span> : null}
                                </div>
                                <div className="attachment-actions">
                                  <button
                                    className="attachment-download-button"
                                    aria-label={`下载 ${getAttachmentOriginalName(attachment, index)}`}
                                    title="下载"
                                    type="button"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      downloadAttachment(attachment);
                                    }}
                                    disabled={downloadingAttachmentUrl === attachment.fileUrl}
                                  >
                                    <Icon name="download" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}

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
                                {submission.attachments.map((attachment, index) => (
                                  <div
                                    className="attachment-item linked attachment-row"
                                    key={`${attachment.fileUrl}-${index}`}
                                    role="button"
                                    tabIndex={0}
                                    title="点击预览"
                                    onClick={() => openAttachmentPreview(attachment)}
                                    onKeyDown={(event) => {
                                      if (event.key === "Enter" || event.key === " ") {
                                        event.preventDefault();
                                        openAttachmentPreview(attachment);
                                      }
                                    }}
                                  >
                                    <AttachmentVisual attachment={attachment} />
                                    <div className="attachment-copy">
                                      <strong title={getAttachmentOriginalName(attachment, index)}>{getAttachmentOriginalName(attachment, index)}</strong>
                                      {attachment.fileSize ? <span>{formatFileSize(attachment.fileSize)}</span> : null}
                                    </div>
                                    <div className="attachment-actions">
                                      <button
                                        className="attachment-download-button"
                                        aria-label={`下载 ${getAttachmentOriginalName(attachment, index)}`}
                                        title="下载"
                                        type="button"
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          downloadAttachment(attachment);
                                        }}
                                        disabled={downloadingAttachmentUrl === attachment.fileUrl}
                                      >
                                        <Icon name="download" />
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : null}
                            {canSelectSubmission(selectedTask) ? (
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
