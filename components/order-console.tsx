"use client";

import Link from "next/link";
import { FormEvent, KeyboardEvent, useCallback, useEffect, useRef, useState } from "react";
import { AppConfirmDialog, AppNoticeDialog, AppToast } from "@/components/app-dialog";
import type { PublishTask, Submission } from "@/lib/caichong";
import { classifyMarketTask } from "@/lib/market-classification";
import type { MarketActivityCategory, MarketActivitySummary, MarketFeedItem, MarketFeedResponse } from "@/lib/market-activity";
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

type SelectConfirmation = {
  taskId: string;
  submissionId: string;
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

type PlatformActivityItem = {
  taskId: string;
  description: string;
  price: number;
  status: string;
  createdAt?: string;
};

type PlatformActivitySummary = {
  todayOrderCount: number;
  monthOrderCount: number;
  totalOrderCount: number;
  todayOrderAmount: number;
  monthOrderAmount: number;
  totalOrderAmount: number;
  recentOrders: PlatformActivityItem[];
  lastSyncedAt?: string;
  source: "caichong_observed" | "unavailable";
};

type MarketHomePreviewData = {
  summary: MarketActivitySummary;
  feed: MarketFeedResponse;
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
const AUTO_REFRESH_INTERVAL_MS = 10 * 60 * 1000;
const PAYMENT_LINK_VALID_MS = 30 * 60 * 1000;
const PAYMENT_POLL_FAST_WINDOW_MS = 2 * 60 * 1000;
const PAYMENT_POLL_MEDIUM_WINDOW_MS = 10 * 60 * 1000;
const PAYMENT_POLL_FAST_INTERVAL_MS = 5 * 1000;
const PAYMENT_POLL_MEDIUM_INTERVAL_MS = 15 * 1000;
const PAYMENT_POLL_SLOW_INTERVAL_MS = 60 * 1000;
const COMPOSER_TEXTAREA_MIN_HEIGHT = 52;
const COMPOSER_TEXTAREA_MAX_HEIGHT = 192;
const TASK_DESCRIPTION_COLLAPSE_THRESHOLD = 320;
const DESCRIPTION_TOO_SHORT_ERROR = "请输入10个字以上的需求描述";
const PRICE_INVALID_ERROR = "请输入1-100元的报酬";
const ATTACHMENT_RULE_TOOLTIP_ID = "attachment-rule-tooltip";
const ATTACHMENT_RULE_COPY = "支持常见图片、文档、音视频等参考附件";
const ATTACHMENT_LIMIT_COPY = "单个附件最大 10MB, 最多 5 个";
const ATTACHMENT_TOO_MANY_ERROR = `最多上传 ${MAX_ATTACHMENTS} 个附件。如需调整，请先删除已选附件。`;
const ATTACHMENT_TOO_LARGE_ERROR = "附件最大不能超过 10MB";

function writePaymentBridgePage(paymentWindow: Window) {
  paymentWindow.document.write(`<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>正在前往付款页面</title>
    <style>
      * {
        box-sizing: border-box;
      }

      html,
      body {
        width: 100%;
        height: 100%;
        margin: 0;
        overflow: hidden;
      }

      body {
        position: relative;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
        color: rgba(246, 255, 247, 0.94);
        background: linear-gradient(180deg, #07110c 0%, #020705 100%);
      }

      .payment-bridge {
        position: absolute;
        top: 47%;
        left: 50%;
        width: min(560px, calc(100vw - 48px));
        overflow: hidden;
        padding: 38px 34px 42px;
        border: 1px solid rgba(125, 201, 143, 0.28);
        border-radius: 26px;
        background:
          linear-gradient(180deg, rgba(31, 55, 38, 0.88), rgba(13, 24, 18, 0.94)),
          rgba(18, 34, 24, 0.92);
        box-shadow: 0 24px 80px rgba(0, 0, 0, 0.36), 0 0 42px rgba(92, 236, 117, 0.1);
        transform: translate(-50%, -50%);
      }

      .payment-content {
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
      }

      .payment-brand {
        display: block;
        width: 150px;
        height: 30px;
        object-fit: contain;
        margin-bottom: 40px;
      }

      .payment-status {
        display: inline-flex;
        align-items: center;
        gap: 9px;
        min-height: 28px;
        color: #66ec7a;
        font-size: 15px;
        font-weight: 500;
      }

      .payment-spinner {
        width: 16px;
        height: 16px;
        border: 2px solid rgba(218, 233, 219, 0.24);
        border-top-color: #66ec7a;
        border-radius: 999px;
        animation: spin 0.8s linear infinite;
      }

      h1 {
        margin: 0 0 14px;
        color: #f7fff8;
        font-size: clamp(24px, 5.1vw, 35px);
        font-weight: 760;
        line-height: 1.15;
        letter-spacing: 0;
      }

      p {
        max-width: 420px;
        margin: 18px 0 0;
        color: rgba(218, 233, 219, 0.72);
        font-size: 14px;
        font-weight: 400;
        line-height: 1.85;
      }

      @keyframes spin {
        to {
          transform: rotate(360deg);
        }
      }

      @media (max-width: 560px) {
        .payment-bridge {
          top: 45%;
          padding: 28px 24px;
          border-radius: 22px;
        }

        .payment-brand {
          width: 136px;
          height: 27px;
          margin-bottom: 32px;
        }
      }
    </style>
  </head>
  <body>
    <main class="payment-bridge" aria-live="polite">
      <div class="payment-content">
        <img class="payment-brand" src="/logo.svg" alt="AICHONG" />
        <h1>正在前往付款页面</h1>
        <div class="payment-status">
          <span class="payment-spinner" aria-hidden="true"></span>
          正在准备安全付款链接
        </div>
        <p>请在新打开的页面完成付款。<br />付款完成后，回到 AICHONG 查看任务状态。</p>
      </div>
    </main>
  </body>
</html>`);
  paymentWindow.document.close();
}
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
const formatRefreshTime = (date = new Date()) => date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
const getSubmissionCount = (task: PublishTask) => task.submissionCount || 0;
const getDateTimeMs = (value?: string) => {
  if (!value) return null;
  const date = new Date(value);
  const time = date.getTime();
  return Number.isNaN(time) ? null : time;
};
const formatPaymentCountdown = (milliseconds: number) => {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
};
const getPaymentPollDelay = (issuedAt: number) => {
  const elapsed = Date.now() - issuedAt;
  if (elapsed < PAYMENT_POLL_FAST_WINDOW_MS) return PAYMENT_POLL_FAST_INTERVAL_MS;
  if (elapsed < PAYMENT_POLL_MEDIUM_WINDOW_MS) return PAYMENT_POLL_MEDIUM_INTERVAL_MS;
  return PAYMENT_POLL_SLOW_INTERVAL_MS;
};
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

function HeartbeatLoadingIcon() {
  return (
    <svg aria-hidden="true" className="heartbeat-loader" fill="none" viewBox="0 0 32 32">
      <path className="heartbeat-loader-glow" d="M5 16h6l2.4-7 5.2 14 2.4-7h6" pathLength={1} />
      <path className="heartbeat-loader-line" d="M5 16h6l2.4-7 5.2 14 2.4-7h6" pathLength={1} />
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

function isKnownUnsupportedPreviewAttachment(attachment: UploadedAttachment) {
  if (isTextLikeAttachment(attachment.fileName, attachment.mimeType) || isImageLikeAttachment(attachment.fileName, attachment.mimeType)) {
    return false;
  }

  const kind = getAttachmentKind(attachment);
  return kind === "video" || kind === "audio" || kind === "doc" || kind === "archive";
}

function isAttachmentValidationError(message?: string | null) {
  return Boolean(message && (message === ATTACHMENT_TOO_MANY_ERROR || message === ATTACHMENT_TOO_LARGE_ERROR));
}

function getDisplayTaskDescription(description: string) {
  return description
    .replace(/^真实接口联调测试：?/, "")
    .replace(/^真实接口测试订单：?/, "测试任务：")
    .replace("这是平台联调使用的小额测试任务。", "这是一条小额测试任务。");
}

function getReadableTaskDescription(description: string) {
  const normalized = getDisplayTaskDescription(description)
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .trim();

  if (!normalized) return "暂无需求描述。";

  if (normalized.includes("\n")) {
    return normalized.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n");
  }

  return normalized
    .replace(/\s*([一二三四五六七八九十]+、)/g, "\n\n$1")
    .replace(/\s+(\d+[.．]\s*)/g, "\n\n$1")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function formatActivityAmount(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return "¥0";
  }

  if (value >= 10000) {
    const amount = value / 10000;
    return `¥${Number.isInteger(amount) ? amount.toFixed(0) : amount.toFixed(1)}万`;
  }

  return `¥${Math.round(value).toLocaleString("zh-CN")}`;
}

function formatActivityTime(value?: string) {
  if (!value) return "";
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.max(0, Math.floor(diffMs / 60000));

  if (diffMinutes < 1) return "刚刚";
  if (diffMinutes < 60) return `${diffMinutes}分钟前`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}小时前`;

  return formatDateTimeToMinute(value);
}

function getActivityDescription(description: string) {
  const normalized = getPublicActivityDescription(description).replace(/\s+/g, " ").trim();
  if (normalized.length <= 30) {
    return normalized || "新的创作任务";
  }

  return `${normalized.slice(0, 30)}...`;
}

function getPublicActivityDescription(description: string) {
  return getDisplayTaskDescription(description)
    .replace(/爱虫是一个caichong\.net的外挂平台，?/gi, "这是一个内容创作服务平台，")
    .replace(/aichong\.top/gi, "平台入口")
    .replace(/caichong\.net/gi, "平台")
    .replace(/caichong/gi, "平台")
    .replace(/AICHONG/gi, "平台")
    .replace(/爱虫/g, "平台")
    .replace(/才虫/g, "平台")
    .replace(/agent/gi, "服务方")
    .replace(/龙虾/g, "高级工具")
    .replace(/外挂/g, "辅助");
}

function getActivityCategory(description: string) {
  const classification = classifyMarketTask(description);
  return classification.confidence >= 0.45 ? classification.category : "任务";
}

function formatMarketPreviewAmount(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "¥0";
  if (value >= 10000) {
    const amount = value / 10000;
    return `¥${Number.isInteger(amount) ? amount.toFixed(0) : amount.toFixed(1)}万`;
  }

  return `¥${Math.round(value).toLocaleString("zh-CN")}`;
}

function getMarketPreviewIcon(category: MarketFeedItem["category"]) {
  const iconMap: Record<MarketFeedItem["category"], string> = {
    文案: "/icons/case-copy.svg",
    图片: "/icons/case-image.svg",
    声音: "/icons/case-music.svg",
    视频: "/icons/case-video.svg"
  };

  return iconMap[category];
}

function isSyncableTask(task: PublishTask) {
  return isSyncableTaskStatus(task.status);
}

function getSubmissionNotice(task: PublishTask, visibleSubmissionCount: number) {
  const deadlineText = task.deadlineAt ? formatDateTimeToMinute(task.deadlineAt) : null;
  const submissionCount = Math.max(visibleSubmissionCount, getSubmissionCount(task));

  if (task.status === "COMPLETED") {
    return {
      tone: "normal" as const,
      title: "已采用投稿，任务完成",
      body: "你已采用其中一份投稿，订单已完成。"
    };
  }

  if (task.status === "CLOSED") {
    if (task.closeReason === "TIMEOUT_NO_SELECTION") {
      return {
        tone: "muted" as const,
        title: "订单已自动关闭",
        body: "选择期内未采用投稿，订单已自动关闭并退款。"
      };
    }

    if (task.closeReason === "TIMEOUT_NO_SUBMISSION") {
      return {
        tone: "muted" as const,
        title: "订单已自动关闭",
        body: "提交期内未收到投稿，订单已自动关闭并退款。"
      };
    }

    return {
      tone: "muted" as const,
      title: "订单已关闭",
      body: task.closeReason ? getCloseReasonLabel(task.closeReason) : "这单已经关闭，当前没有可处理的投稿。"
    };
  }

  if (task.status === "PENDING_SELECTION") {
    return {
      tone: "warning" as const,
      title: "已进入选择期",
      body: deadlineText
        ? `请在 ${deadlineText} 前采用一份满意投稿。逾期订单会自动关闭并退款。`
        : "请尽快采用一份满意投稿。逾期订单会自动关闭并退款。"
    };
  }

  if (task.status === "ACTIVE") {
    if (submissionCount > 0) {
      return {
        tone: "normal" as const,
        title: "已收到投稿",
        body: deadlineText
          ? `提交期至 ${deadlineText}。你可以继续等待更多投稿，也可以提前采用满意结果。`
          : "你可以继续等待更多投稿，也可以提前采用满意结果。"
      };
    }

    return null;
  }

  return null;
}

async function readJson<T>(response: Response): Promise<T> {
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "请求失败");
  }
  return data as T;
}

function PlatformActivityPanel({
  activity,
  isLoading,
  isPaused
}: {
  activity: PlatformActivitySummary | null;
  isLoading: boolean;
  isPaused: boolean;
}) {
  const recentOrders = activity?.recentOrders || [];
  const shouldShowTotalMetric = (activity?.totalOrderCount || 0) > (activity?.monthOrderCount || 0);
  const [activeOrderIndex, setActiveOrderIndex] = useState(0);
  const activeOrder = recentOrders[activeOrderIndex] || recentOrders[0];

  useEffect(() => {
    if (recentOrders.length <= 1 || isPaused) {
      return;
    }

    const timer = window.setInterval(() => {
      setActiveOrderIndex((currentIndex) => (currentIndex + 1) % recentOrders.length);
    }, 7000);

    return () => window.clearInterval(timer);
  }, [recentOrders.length, isPaused]);

  useEffect(() => {
    if (activeOrderIndex >= recentOrders.length) {
      setActiveOrderIndex(0);
    }
  }, [activeOrderIndex, recentOrders.length]);

  return (
    <aside className="platform-activity-panel" aria-label="才虫公开市场发单动态">
      <div className={`platform-metric-grid ${shouldShowTotalMetric ? "has-total" : ""}`} aria-busy={isLoading}>
        <div className="platform-metric primary">
          <span>今日发单</span>
          <strong>{isLoading ? "--" : activity?.todayOrderCount ?? 0}</strong>
        </div>
        <div className="platform-metric">
          <span>今日发单额</span>
          <strong>{isLoading ? "--" : formatActivityAmount(activity?.todayOrderAmount ?? 0)}</strong>
        </div>
        <div className="platform-metric">
          <span>本月发单</span>
          <strong>{isLoading ? "--" : activity?.monthOrderCount ?? 0}</strong>
        </div>
        <div className="platform-metric">
          <span>本月发单额</span>
          <strong>{isLoading ? "--" : formatActivityAmount(activity?.monthOrderAmount ?? 0)}</strong>
        </div>
        {shouldShowTotalMetric ? (
          <div className="platform-metric">
            <span>累计发单</span>
            <strong>{isLoading ? "--" : activity?.totalOrderCount ?? 0}</strong>
          </div>
        ) : null}
      </div>

      {activeOrder ? (
        <div className="platform-live-list" aria-live="off">
          <article className="platform-live-item" key={activeOrder.taskId}>
            <span className="platform-live-kind">{getActivityCategory(activeOrder.description)}</span>
            <span className="platform-live-content">
              <strong>{getActivityDescription(activeOrder.description)}</strong>
              <span className="platform-live-meta">
                {formatActivityTime(activeOrder.createdAt)}
              </span>
            </span>
          </article>
        </div>
      ) : null}
    </aside>
  );
}

function MarketHomePreviewPanel({ feed: initialFeed, summary }: MarketHomePreviewData) {
  const [feed, setFeed] = useState(initialFeed);
  const [activeCategory, setActiveCategory] = useState<MarketActivityCategory>("全部");
  const [selectedTask, setSelectedTask] = useState<MarketFeedItem | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isFilterPinned, setIsFilterPinned] = useState(false);
  const filterSentinelRef = useRef<HTMLDivElement | null>(null);
  const marketStats = [
    ["今日发单", summary.todayOrderCount.toLocaleString("zh-CN")],
    ["本月发单", summary.monthOrderCount.toLocaleString("zh-CN")],
    ["本月发单额", formatMarketPreviewAmount(summary.monthOrderAmount)],
    ["累计发单", summary.totalOrderCount.toLocaleString("zh-CN")]
  ];
  const previewItems = feed.items;

  async function changeCategory(category: MarketActivityCategory) {
    setActiveCategory(category);
    setIsLoading(true);

    try {
      const response = await fetch(`/api/platform/market?category=${encodeURIComponent(category)}&pageSize=48`, {
        cache: "no-store"
      });
      setFeed(await readJson<MarketFeedResponse>(response));
    } catch {
      setFeed((currentFeed) => ({
        ...currentFeed,
        items: []
      }));
    } finally {
      setIsLoading(false);
    }
  }

  function openTaskFromKeyboard(event: KeyboardEvent<HTMLElement>, item: MarketFeedItem) {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    setSelectedTask(item);
  }

  useEffect(() => {
    const sentinel = filterSentinelRef.current;
    if (!sentinel || typeof IntersectionObserver === "undefined") {
      return;
    }

    const root = sentinel.closest(".studio-content");
    const observer = new IntersectionObserver(([entry]) => {
      setIsFilterPinned(!entry.isIntersecting);
    }, { root });

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  return (
    <section className="home-market-preview" aria-label="首页市场动态预览">
      <div className="home-market-stats" aria-label="发单统计">
        {marketStats.map(([label, value]) => (
          <div className="home-market-stat" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>

      <div className="home-market-use-cases">
        <div className="home-market-sticky-sentinel" ref={filterSentinelRef} aria-hidden="true" />
        <div className={`home-market-use-case-bar${isFilterPinned ? " is-pinned" : ""}`}>
          <div className="home-market-category-tabs" aria-label="任务类型筛选">
            {feed.categories.map((category) => (
              <button
                className={activeCategory === category.key ? "active" : ""}
                key={category.key}
                type="button"
                onClick={() => void changeCategory(category.key)}
              >
                <span>{category.label}</span>
                <small>{category.count}</small>
              </button>
            ))}
          </div>
        </div>

        <div className={`home-market-card-grid ${isLoading ? "is-loading" : ""}`} aria-busy={isLoading}>
          {previewItems.length > 0 ? (
            previewItems.map((item) => (
              <article
                className={`market-task-card market-task-card-compact market-task-card-${item.category}`}
                key={item.taskId}
                role="button"
                tabIndex={0}
                aria-label={`查看需求：${item.title}`}
                onClick={() => setSelectedTask(item)}
                onKeyDown={(event) => openTaskFromKeyboard(event, item)}
              >
                <div className="market-task-card-top">
                  <span>{item.category}</span>
                  <small>{formatActivityTime(item.createdAt)}</small>
                </div>
                <h2>{item.title}</h2>
                <img className="market-task-card-figure" src={getMarketPreviewIcon(item.category)} alt="" aria-hidden="true" />
                <div className="market-task-card-bottom">
                  <span>{item.statusLabel}</span>
                </div>
              </article>
            ))
          ) : (
            <div className="home-market-empty">当前分类暂无可展示任务。</div>
          )}
        </div>
      </div>

      {selectedTask ? (
        <div className="market-detail-layer">
          <button className="market-detail-backdrop" aria-label="关闭详情" type="button" onClick={() => setSelectedTask(null)} />
          <section className="market-detail-modal" role="dialog" aria-modal="true" aria-labelledby="market-home-detail-title">
            <button className="market-detail-close" aria-label="关闭详情" type="button" onClick={() => setSelectedTask(null)}>
              <Icon name="close" />
            </button>
            <div className="market-detail-header">
              <div>
                <span>{selectedTask.category}</span>
                <h2 id="market-home-detail-title">{selectedTask.title}</h2>
              </div>
            </div>
            <div className="market-detail-meta">
              <span>{selectedTask.statusLabel}</span>
              <span>{formatActivityTime(selectedTask.createdAt)}</span>
            </div>
            <div className="market-detail-body">
              {selectedTask.description.split(/\n{2,}/).map((paragraph, index) => (
                <p key={`${selectedTask.taskId}-${index}`}>{paragraph}</p>
              ))}
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}

export function OrderConsole({ marketPreview }: { marketPreview?: MarketHomePreviewData } = {}) {
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [loginPhone, setLoginPhone] = useState("");
  const [loginCode, setLoginCode] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const [tasks, setTasks] = useState<PublishTask[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<PublishTask | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [dataSource, setDataSource] = useState<"mock" | "caichong" | "supabase" | "unknown">("unknown");
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [configHealth, setConfigHealth] = useState<ConfigHealth | null>(null);
  const [platformActivity, setPlatformActivity] = useState<PlatformActivitySummary | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [hasResolvedInitialRoute, setHasResolvedInitialRoute] = useState(false);
  const [hasLoadedTasks, setHasLoadedTasks] = useState(false);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isRefreshingPayment, setIsRefreshingPayment] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isPlatformActivityLoading, setIsPlatformActivityLoading] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [isComposerFocused, setIsComposerFocused] = useState(false);
  const [codeCooldown, setCodeCooldown] = useState(0);
  const [uploadProgressText, setUploadProgressText] = useState<string | null>(null);
  const [selectingSubmissionId, setSelectingSubmissionId] = useState<string | null>(null);
  const [attachmentPreviewModal, setAttachmentPreviewModal] = useState<AttachmentPreviewModal | null>(null);
  const [selectConfirmation, setSelectConfirmation] = useState<SelectConfirmation | null>(null);
  const [isPaymentSuccessNoticeOpen, setIsPaymentSuccessNoticeOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isAttachmentTooltipSuppressed, setIsAttachmentTooltipSuppressed] = useState(false);
  const [previewLoadingUrl, setPreviewLoadingUrl] = useState<string | null>(null);
  const [downloadStartingAttachmentUrl, setDownloadStartingAttachmentUrl] = useState<string | null>(null);
  const [taskFilter, setTaskFilter] = useState<TaskFilter>("all");
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const [isTaskDescriptionExpanded, setIsTaskDescriptionExpanded] = useState(false);
  const [pendingPaymentTaskId, setPendingPaymentTaskId] = useState<string | null>(null);
  const [paymentLinkIssuedAtByTaskId, setPaymentLinkIssuedAtByTaskId] = useState<Record<string, number>>({});
  const [paymentNow, setPaymentNow] = useState(() => Date.now());
  const [lastRefreshAt, setLastRefreshAt] = useState<string | null>(null);
  const [lastDetailLoadedAt, setLastDetailLoadedAt] = useState<string | null>(null);
  const [autoRefreshError, setAutoRefreshError] = useState<string | null>(null);
  const [readSubmissionCounts, setReadSubmissionCounts] = useState<Record<string, number>>({});
  const descriptionTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const homeComposerFormRef = useRef<HTMLFormElement | null>(null);
  const compactComposerFormRef = useRef<HTMLFormElement | null>(null);
  const downloadStartResetTimerRef = useRef<number | null>(null);
  const filterMenuRef = useRef<HTMLElement | null>(null);
  const accountMenuRef = useRef<HTMLDivElement | null>(null);
  const shouldPublishAfterLoginRef = useRef(false);
  const refreshInFlightRef = useRef(false);
  const paymentPollInFlightRef = useRef(false);
  const hasCheckedPendingPaymentRouteRef = useRef(false);
  const selectedTaskIdRef = useRef<string | null>(null);
  const detailRequestSeqRef = useRef(0);
  const [isCompactComposerVisible, setIsCompactComposerVisible] = useState(false);
  const [isCompactComposerExpanded, setIsCompactComposerExpanded] = useState(false);
  const [usesShortCompactPrompt, setUsesShortCompactPrompt] = useState(false);

  useEffect(() => {
    if (!attachmentPreviewModal || typeof window === "undefined") {
      return;
    }

    const { body, documentElement } = document;
    const previousOverflow = body.style.overflow;
    const previousPaddingRight = body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - documentElement.clientWidth;

    body.style.overflow = "hidden";
    if (scrollbarWidth > 0) {
      body.style.paddingRight = `${scrollbarWidth}px`;
    }

    return () => {
      body.style.overflow = previousOverflow;
      body.style.paddingRight = previousPaddingRight;
    };
  }, [attachmentPreviewModal]);

  const canLogin = isPhoneValid(loginPhone) && isCodeValid(loginCode) && !isLoggingIn;
  const canSendCode = isPhoneValid(loginPhone) && !isSendingCode && codeCooldown === 0;
  const isPhoneLoggedIn = currentUser?.authMode === "phone";
  const isPublishDisabled = isCreating || description.trim().length === 0;
  const shouldShowDescriptionError = error === DESCRIPTION_TOO_SHORT_ERROR;
  const shouldShowPriceError = error === PRICE_INVALID_ERROR;
  const shouldShowAttachmentError = isAttachmentValidationError(error);
  const shouldShowComposerValidationError = shouldShowDescriptionError || shouldShowPriceError || shouldShowAttachmentError;
  const descriptionLength = description.trim().length;
  const shouldPausePlatformActivity = isComposerFocused || descriptionLength > 0;
  const visibleTasks = tasks;
  const filteredTasks = visibleTasks.filter((task) => taskFilter === "all" || task.status === taskFilter);
  const shouldShowSidebarOrders = Boolean(isPhoneLoggedIn && hasLoadedTasks && visibleTasks.length > 0);
  const hasCurrentUserSyncableTasks = tasks.some(isSyncableTask);
  const hasUnreadSubmissionsAcrossTasks = visibleTasks.some(hasUnreadSubmissions);
  const selectedTaskSubmissionNotice = selectedTask ? getSubmissionNotice(selectedTask, submissions.length) : null;
  const selectedTaskReadableDescription = selectedTask ? getReadableTaskDescription(selectedTask.description) : "";
  const shouldCollapseTaskDescription =
    selectedTaskReadableDescription.length > TASK_DESCRIPTION_COLLAPSE_THRESHOLD ||
    selectedTaskReadableDescription.split("\n").length > 8;
  const visibleTaskDescription =
    shouldCollapseTaskDescription && !isTaskDescriptionExpanded
      ? `${selectedTaskReadableDescription.slice(0, TASK_DESCRIPTION_COLLAPSE_THRESHOLD).trimEnd()}...`
      : selectedTaskReadableDescription;
  const refreshMetaText = isSyncing
    ? "正在同步"
    : autoRefreshError || (lastRefreshAt ? `已同步 ${lastRefreshAt}` : lastDetailLoadedAt ? `已加载 ${lastDetailLoadedAt}` : "读取中");
  const shouldShowDetailLoadingState = Boolean(selectedTaskId && (isDetailLoading || (!selectedTask && !error)));
  const selectedPaymentLinkIssuedAt =
    selectedTask?.status === "PENDING_PAYMENT"
      ? paymentLinkIssuedAtByTaskId[selectedTask.taskId] || getDateTimeMs(selectedTask.createdAt)
      : null;
  const selectedPaymentLinkExpiresAt =
    selectedTask?.status === "PENDING_PAYMENT" && selectedPaymentLinkIssuedAt ? selectedPaymentLinkIssuedAt + PAYMENT_LINK_VALID_MS : null;
  const selectedPaymentCountdownMs = selectedPaymentLinkExpiresAt ? selectedPaymentLinkExpiresAt - paymentNow : 0;
  const isSelectedPaymentLinkExpired = selectedTask?.status === "PENDING_PAYMENT" && Boolean(selectedPaymentLinkExpiresAt) && selectedPaymentCountdownMs <= 0;
  const selectedPaymentCountdownText =
    selectedTask?.status === "PENDING_PAYMENT" && !isSelectedPaymentLinkExpired && selectedPaymentLinkExpiresAt
      ? formatPaymentCountdown(selectedPaymentCountdownMs)
      : "";

  function resizeDescriptionTextarea() {
    const textarea = descriptionTextareaRef.current;
    if (!textarea) {
      return;
    }

    textarea.style.height = "auto";
    const nextHeight = Math.min(
      Math.max(textarea.scrollHeight, COMPOSER_TEXTAREA_MIN_HEIGHT),
      COMPOSER_TEXTAREA_MAX_HEIGHT
    );
    textarea.style.height = `${nextHeight}px`;
    textarea.style.overflowY = textarea.scrollHeight > COMPOSER_TEXTAREA_MAX_HEIGHT ? "auto" : "hidden";
  }

  function getSubmissionReadStorageKey() {
    return SUBMISSION_READ_COUNTS_STORAGE_KEY;
  }

  function saveReadSubmissionCounts(nextCounts: Record<string, number>) {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(getSubmissionReadStorageKey(), JSON.stringify(nextCounts));
  }

  function showToast(messageText: string) {
    setToastMessage(messageText);
  }

  function resetLoginForm({ clearPhone = false }: { clearPhone?: boolean } = {}) {
    if (clearPhone) {
      setLoginPhone("");
    }
    setLoginCode("");
    setLoginError(null);
    setCodeCooldown(0);
  }

  function openLoginModal() {
    resetLoginForm();
    setError(null);
    setMessage(null);
    setIsLoginOpen(true);
  }

  function closeLoginModal() {
    resetLoginForm();
    setIsLoginOpen(false);
  }

  function readStoredSubmissionReadCounts(): Record<string, number> {
    if (typeof window === "undefined") {
      return {};
    }

    try {
      const storedCounts = window.localStorage.getItem(getSubmissionReadStorageKey());
      return storedCounts ? (JSON.parse(storedCounts) as Record<string, number>) : {};
    } catch {
      return {};
    }
  }

  function reconcileSubmissionReadCounts(nextTasks: PublishTask[]) {
    if (typeof window === "undefined") {
      return;
    }

    const storedCounts = readStoredSubmissionReadCounts();
    let didChange = window.localStorage.getItem(getSubmissionReadStorageKey()) === null;
    const nextCounts = { ...storedCounts };

    nextTasks.forEach((task) => {
      const submissionCount = getSubmissionCount(task);
      if (nextCounts[task.taskId] === undefined) {
        nextCounts[task.taskId] = submissionCount;
        didChange = true;
      }
    });

    if (didChange) {
      saveReadSubmissionCounts(nextCounts);
    }
    setReadSubmissionCounts(nextCounts);
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
    selectedTaskIdRef.current = taskId;
    if (!taskId) {
      detailRequestSeqRef.current += 1;
      setIsDetailLoading(false);
    }

    if (taskId !== selectedTaskId) {
      setSelectedTask(null);
      setSubmissions([]);
      if (taskId) {
        setIsDetailLoading(true);
      }
    }
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

  function focusHomeComposer() {
    const scroller = document.querySelector(".studio-content");
    const composer = homeComposerFormRef.current;
    setIsCompactComposerExpanded(false);

    const isMobileViewport = typeof window !== "undefined" && window.matchMedia("(max-width: 720px)").matches;
    if (scroller instanceof HTMLElement && composer) {
      const targetTop = isMobileViewport ? Math.max(0, composer.offsetTop - 18) : 0;
      scroller.scrollTo({ top: targetTop, left: 0, behavior: "smooth" });
    } else {
      composer?.scrollIntoView({ behavior: "smooth", block: isMobileViewport ? "start" : "center", inline: "nearest" });
    }

    if (isMobileViewport) {
      return;
    }

    window.requestAnimationFrame(() => {
      if (scroller instanceof HTMLElement) {
        scroller.scrollLeft = 0;
      }
      descriptionTextareaRef.current?.focus({ preventScroll: true });
    });
  }

  const syncCompactComposerVisibility = useCallback(() => {
    if (!marketPreview || selectedTaskId) {
      setIsCompactComposerVisible(false);
      setIsCompactComposerExpanded(false);
      return;
    }

    const composer = homeComposerFormRef.current;
    if (!composer) {
      return;
    }

    const shouldShowCompactComposer = composer.getBoundingClientRect().bottom < 0;
    setIsCompactComposerVisible(shouldShowCompactComposer);
    if (!shouldShowCompactComposer) {
      setIsCompactComposerExpanded(false);
    }
  }, [marketPreview, selectedTaskId]);

  async function loadTasks() {
    setIsLoading(true);
    setError(null);

    try {
      const data = await readJson<{ tasks: PublishTask[]; source?: "mock" | "caichong" | "supabase" }>(
        await fetch("/api/tasks?page=1&pageSize=20")
      );
      const nextTasks = data.tasks || [];
      setTasks(nextTasks);
      reconcileSubmissionReadCounts(nextTasks);
      setDataSource(data.source || "unknown");
      setAutoRefreshError(null);
      return nextTasks;

    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "订单读取失败");
      return [];
    } finally {
      setIsLoading(false);
      setHasLoadedTasks(true);
    }
  }

  function mergeTaskIntoList(nextTask: PublishTask) {
    setTasks((currentTasks) => {
      const hasTask = currentTasks.some((task) => task.taskId === nextTask.taskId);
      if (!hasTask) {
        return [nextTask, ...currentTasks];
      }

      return currentTasks.map((task) => (task.taskId === nextTask.taskId ? { ...task, ...nextTask } : task));
    });
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

  async function loadPlatformActivity() {
    setIsPlatformActivityLoading(true);
    try {
      const activity = await readJson<PlatformActivitySummary>(await fetch("/api/platform/activity"));
      setPlatformActivity(activity);
    } catch {
      setPlatformActivity({
        todayOrderCount: 0,
        monthOrderCount: 0,
        totalOrderCount: 0,
        todayOrderAmount: 0,
        monthOrderAmount: 0,
        totalOrderAmount: 0,
        recentOrders: [],
        source: "unavailable"
      });
    } finally {
      setIsPlatformActivityLoading(false);
    }
  }

  async function loadTaskDetail(taskId: string, options: { showLoading?: boolean; markRead?: boolean } = {}): Promise<PublishTask | null> {
    const requestSeq = detailRequestSeqRef.current + 1;
    detailRequestSeqRef.current = requestSeq;
    const shouldShowLoading = options.showLoading ?? !selectedTask;
    const shouldMarkRead = options.markRead ?? true;
    if (shouldShowLoading) {
      setIsDetailLoading(true);
    }
    setError(null);

    try {
      const task = await readJson<PublishTask>(await fetch(`/api/tasks/${taskId}`));
      if (detailRequestSeqRef.current !== requestSeq || selectedTaskIdRef.current !== taskId) {
        return null;
      }

      setSelectedTask(task);
      mergeTaskIntoList(task);

      try {
        const submissionData = await readJson<{ submissions?: Submission[] } | Submission[]>(await fetch(`/api/tasks/${taskId}/submissions`));
        if (detailRequestSeqRef.current !== requestSeq || selectedTaskIdRef.current !== taskId) {
          return null;
        }

        const nextSubmissions = Array.isArray(submissionData) ? submissionData : submissionData.submissions || [];
        setSubmissions(nextSubmissions);
        if (shouldMarkRead) {
          markTaskSubmissionsRead(taskId, Math.max(getSubmissionCount(task), nextSubmissions.length));
        }
      } catch {
        if (detailRequestSeqRef.current !== requestSeq || selectedTaskIdRef.current !== taskId) {
          return null;
        }

        setSubmissions([]);
        if (shouldMarkRead) {
          markTaskSubmissionsRead(taskId, getSubmissionCount(task));
        }
      }

      setAutoRefreshError(null);
      setLastDetailLoadedAt(formatRefreshTime());
      return task;
    } catch (detailError) {
      if (detailRequestSeqRef.current !== requestSeq || selectedTaskIdRef.current !== taskId) {
        return null;
      }

      setError(detailError instanceof Error ? detailError.message : "订单详情读取失败");
      setSelectedTask(null);
      setSubmissions([]);
      return null;
    } finally {
      if (detailRequestSeqRef.current === requestSeq && selectedTaskIdRef.current === taskId) {
        if (shouldShowLoading) {
          setIsDetailLoading(false);
        }
      }
    }
  }

  async function refreshPaymentUrl(taskId: string, options: { silent?: boolean } = {}) {
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
      setPaymentLinkIssuedAtByTaskId((current) => ({ ...current, [taskId]: Date.now() }));
      if (!options.silent) {
        setMessage("付款入口已刷新。");
      }
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
    if (isKnownUnsupportedPreviewAttachment(attachment)) {
      setError(null);
      showToast("请下载查看");
      return;
    }

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

      showToast("请下载查看");
    } catch (previewError) {
      setError(previewError instanceof Error ? previewError.message : "附件预览失败");
    } finally {
      setPreviewLoadingUrl(null);
    }
  }

  function downloadAttachment(attachment: UploadedAttachment) {
    setError(null);
    setDownloadStartingAttachmentUrl(attachment.fileUrl);
    showToast("正在开始下载");

    if (downloadStartResetTimerRef.current) {
      window.clearTimeout(downloadStartResetTimerRef.current);
    }
    downloadStartResetTimerRef.current = window.setTimeout(() => {
      setDownloadStartingAttachmentUrl(null);
      downloadStartResetTimerRef.current = null;
    }, 1200);

    const link = document.createElement("a");
    link.href = getAttachmentDownloadUrl(attachment);
    link.download = attachment.fileName || "submission-attachment";
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  async function selectSubmission(taskId: string, submissionId: string) {
    setSelectConfirmation(null);
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

  async function syncHeartbeat({ silent = false }: { silent?: boolean } = {}) {
    if (refreshInFlightRef.current) {
      return;
    }

    refreshInFlightRef.current = true;
    setIsSyncing(true);
    setAutoRefreshError(null);
    if (!silent) {
      setMessage(null);
      setError(null);
    }

    try {
      await readJson<{ checkedEvents: number; messages: string[] }>(
        await fetch("/api/sync/heartbeat", {
          method: "POST"
        })
      );

      setLastRefreshAt(formatRefreshTime());
      await Promise.all([
        loadTasks(),
        selectedTaskId ? loadTaskDetail(selectedTaskId, { markRead: !silent, showLoading: false }) : loadPlatformActivity()
      ]);
    } catch (syncError) {
      if (!silent) {
        setError(syncError instanceof Error ? syncError.message : "刷新失败");
      } else {
        setAutoRefreshError("自动刷新失败，可手动重试");
      }
    } finally {
      refreshInFlightRef.current = false;
      setIsSyncing(false);
    }
  }

  async function reopenPaymentForSelectedTask() {
    if (!selectedTask || selectedTask.status !== "PENDING_PAYMENT") {
      return;
    }

    let paymentWindow: Window | null = null;
    try {
      paymentWindow = window.open("", "_blank");
      if (paymentWindow) {
        writePaymentBridgePage(paymentWindow);
      }
    } catch {
      paymentWindow = null;
    }

    setMessage(null);
    setError(null);

    try {
      let nextPaymentUrl = selectedTask.paymentUrl;
      if (!nextPaymentUrl || isSelectedPaymentLinkExpired) {
        nextPaymentUrl = (await refreshPaymentUrl(selectedTask.taskId, { silent: true })) || undefined;
      }

      if (!nextPaymentUrl) {
        throw new Error("付款页面暂时没有打开，请稍后重试。");
      }

      setPendingPaymentTaskId(selectedTask.taskId);
      window.sessionStorage.setItem(PENDING_PAYMENT_TASK_STORAGE_KEY, selectedTask.taskId);

      if (paymentWindow) {
        paymentWindow.location.href = nextPaymentUrl;
      } else {
        window.open(nextPaymentUrl, "_blank", "noopener,noreferrer");
      }
    } catch (paymentError) {
      paymentWindow?.close();
      setError(paymentError instanceof Error ? paymentError.message : "付款入口打开失败");
    }
  }

  async function sendLoginCode() {
    if (!isPhoneValid(loginPhone)) {
      setLoginError("请输入 11 位中国大陆手机号");
      return;
    }

    setIsSendingCode(true);
    setLoginError(null);

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
      setCodeCooldown(60);
    } catch (sendError) {
      setLoginError(sendError instanceof Error ? sendError.message : "验证码发送失败");
    } finally {
      setIsSendingCode(false);
    }
  }

  async function loginWithPhoneCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isPhoneValid(loginPhone)) {
      setLoginError("请输入 11 位中国大陆手机号");
      return;
    }

    if (!isCodeValid(loginCode)) {
      setLoginError("请输入 6 位数字验证码");
      return;
    }

    setIsLoggingIn(true);
    setLoginError(null);
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
      setLoginPhone(user.phone);
      setLoginCode("");
      setLoginError(null);
      setCodeCooldown(0);
      updateSelectedTask(null);
      const shouldPublishAfterLogin = shouldPublishAfterLoginRef.current;
      shouldPublishAfterLoginRef.current = false;

      if (shouldPublishAfterLogin) {
        await publishTask();
      } else {
        await loadTasks();
      }
    } catch (loginError) {
      setLoginError(loginError instanceof Error ? loginError.message : "登录失败");
    } finally {
      setIsLoggingIn(false);
    }
  }

  async function logout() {
    const previousPhone = currentUser?.phone || loginPhone;
    await fetch("/api/auth/logout", {
      method: "POST"
    });
    window.sessionStorage.removeItem(PENDING_PAYMENT_TASK_STORAGE_KEY);
    detailRequestSeqRef.current += 1;
    selectedTaskIdRef.current = null;
    shouldPublishAfterLoginRef.current = false;
    setCurrentUser(null);
    setTasks([]);
    setHasLoadedTasks(false);
    updateSelectedTask(null);
    setSelectedTask(null);
    setSubmissions([]);
    setPendingPaymentTaskId(null);
    setPaymentLinkIssuedAtByTaskId({});
    setIsPaymentSuccessNoticeOpen(false);
    setIsLoginOpen(false);
    setIsAccountMenuOpen(false);
    setMessage(null);
    setError(null);
    resetLoginForm();
    setLoginPhone(previousPhone);
    await loadCurrentUser();
  }

  function addAttachments(files: FileList | null) {
    if (!files?.length) return;

    const nextFiles = Array.from(files);
    const accepted: PendingAttachment[] = [];
    let validationError: string | null = null;

    for (const file of nextFiles) {
      if (attachments.length + accepted.length >= MAX_ATTACHMENTS) {
        validationError = ATTACHMENT_TOO_MANY_ERROR;
        break;
      }

      if (file.size > MAX_ATTACHMENT_SIZE) {
        validationError = ATTACHMENT_TOO_LARGE_ERROR;
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

    setError((currentError) => validationError || (isAttachmentValidationError(currentError) ? null : currentError));
  }

  function removeAttachment(index: number) {
    setAttachments((current) => current.filter((_, itemIndex) => itemIndex !== index));
    setError((currentError) => (isAttachmentValidationError(currentError) ? null : currentError));
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
    if (price.trim() === "") {
      return;
    }

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
      openLoginModal();
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
      setError(PRICE_INVALID_ERROR);
      return;
    }

    let paymentWindow: Window | null = null;
    try {
      paymentWindow = window.open("", "_blank");
      if (paymentWindow) {
        writePaymentBridgePage(paymentWindow);
      }
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
      setPaymentLinkIssuedAtByTaskId((current) => ({ ...current, [task.taskId]: Date.now() }));
      updateSelectedTask(task.taskId);
      setSelectedTask({ ...task, paymentUrl });
      setSubmissions([]);
      setPendingPaymentTaskId(task.taskId);
      setMessage(null);
      setDescription("");
      setAttachments([]);
      await loadTasks();
      await loadPlatformActivity();
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
    loadPlatformActivity();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const mediaQuery = window.matchMedia("(max-width: 720px)");
    const updateCompactPrompt = () => setUsesShortCompactPrompt(mediaQuery.matches);
    updateCompactPrompt();
    mediaQuery.addEventListener("change", updateCompactPrompt);
    return () => mediaQuery.removeEventListener("change", updateCompactPrompt);
  }, []);

  useEffect(() => {
    resizeDescriptionTextarea();
  }, [description]);

  useEffect(() => {
    setIsTaskDescriptionExpanded(false);
  }, [selectedTaskId]);

  useEffect(() => {
    if (!marketPreview || selectedTaskId) {
      setIsCompactComposerVisible(false);
      setIsCompactComposerExpanded(false);
      return;
    }

    const composerNode = homeComposerFormRef.current;
    if (!composerNode) {
      return;
    }

    let frameId = 0;
    const updateCompactComposerVisibility = () => {
      frameId = 0;
      syncCompactComposerVisibility();
    };

    const scheduleUpdate = () => {
      if (frameId) {
        return;
      }
      frameId = window.requestAnimationFrame(updateCompactComposerVisibility);
    };

    const scroller = document.querySelector(".studio-content");
    syncCompactComposerVisibility();
    window.addEventListener("resize", scheduleUpdate);
    window.addEventListener("scroll", scheduleUpdate, { passive: true });
    scroller?.addEventListener("scroll", scheduleUpdate, { passive: true });

    return () => {
      if (frameId) {
        window.cancelAnimationFrame(frameId);
      }
      window.removeEventListener("resize", scheduleUpdate);
      window.removeEventListener("scroll", scheduleUpdate);
      scroller?.removeEventListener("scroll", scheduleUpdate);
    };
  }, [marketPreview, selectedTaskId, syncCompactComposerVisibility]);

  useEffect(() => {
    if (!isCompactComposerExpanded) {
      return;
    }

    function collapseCompactComposer() {
      setIsCompactComposerExpanded(false);
    }

    function handlePointerDown(event: PointerEvent) {
      const composerNode = compactComposerFormRef.current;
      if (!composerNode || !(event.target instanceof Node) || composerNode.contains(event.target)) {
        return;
      }

      collapseCompactComposer();
    }

    const scroller = document.querySelector(".studio-content");
    document.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("scroll", collapseCompactComposer, { passive: true });
    scroller?.addEventListener("scroll", collapseCompactComposer, { passive: true });

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("scroll", collapseCompactComposer);
      scroller?.removeEventListener("scroll", collapseCompactComposer);
    };
  }, [isCompactComposerExpanded]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      const storedCounts = window.localStorage.getItem(SUBMISSION_READ_COUNTS_STORAGE_KEY);
      setReadSubmissionCounts(storedCounts ? (JSON.parse(storedCounts) as Record<string, number>) : {});
    } catch {
      setReadSubmissionCounts({});
    }
  }, []);

  useEffect(() => {
    const taskIdFromUrl = new URLSearchParams(window.location.search).get("task");
    if (taskIdFromUrl) {
      selectedTaskIdRef.current = taskIdFromUrl;
      setIsDetailLoading(true);
      setSelectedTaskId(taskIdFromUrl);
    }
    setHasResolvedInitialRoute(true);
  }, []);

  useEffect(() => {
    if (!isAuthLoading && !isPhoneLoggedIn && selectedTaskId) {
      updateSelectedTask(null);
      return;
    }

    if (selectedTaskId) {
      if (!isPhoneLoggedIn) {
        return;
      }
      selectedTaskIdRef.current = selectedTaskId;
      loadTaskDetail(selectedTaskId);
    } else {
      selectedTaskIdRef.current = null;
      detailRequestSeqRef.current += 1;
      setSelectedTask(null);
      setSubmissions([]);
      setIsDetailLoading(false);
      setLastDetailLoadedAt(null);
    }
  }, [isAuthLoading, isPhoneLoggedIn, selectedTaskId]);

  useEffect(() => {
    if (selectedTask?.status !== "PENDING_PAYMENT") {
      return;
    }

    const timer = window.setInterval(() => setPaymentNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [selectedTask?.taskId, selectedTask?.status]);

  useEffect(() => {
    if (!selectedTask || selectedTask.status === "PENDING_PAYMENT" || pendingPaymentTaskId !== selectedTask.taskId) {
      return;
    }

    window.sessionStorage.removeItem(PENDING_PAYMENT_TASK_STORAGE_KEY);
    setPendingPaymentTaskId(null);
    setPaymentLinkIssuedAtByTaskId((current) => {
      const { [selectedTask.taskId]: _removed, ...rest } = current;
      return rest;
    });

    if (selectedTask.status === "ACTIVE") {
      setIsPaymentSuccessNoticeOpen(true);
    }
  }, [pendingPaymentTaskId, selectedTask]);

  useEffect(() => {
    if (!selectedTask || selectedTask.status !== "PENDING_PAYMENT" || !selectedPaymentLinkIssuedAt || isSelectedPaymentLinkExpired) {
      return;
    }

    const issuedAt = selectedPaymentLinkIssuedAt;
    const taskId = selectedTask.taskId;
    let timer: number | null = null;
    let cancelled = false;

    async function pollPaymentStatus() {
      if (cancelled || !selectedTaskIdRef.current || Date.now() >= issuedAt + PAYMENT_LINK_VALID_MS) {
        return;
      }

      if (typeof document !== "undefined" && document.hidden) {
        timer = window.setTimeout(pollPaymentStatus, PAYMENT_POLL_MEDIUM_INTERVAL_MS);
        return;
      }

      if (paymentPollInFlightRef.current) {
        timer = window.setTimeout(pollPaymentStatus, getPaymentPollDelay(issuedAt));
        return;
      }

      paymentPollInFlightRef.current = true;
      try {
        const latestTask = await loadTaskDetail(taskId, { showLoading: false, markRead: false });
        if (!latestTask || cancelled) {
          return;
        }

        if (latestTask.status !== "PENDING_PAYMENT") {
          await loadTasks();
          mergeTaskIntoList(latestTask);
          if (latestTask.status === "ACTIVE") {
            setIsPaymentSuccessNoticeOpen(true);
          }
          return;
        }
      } finally {
        paymentPollInFlightRef.current = false;
      }

      if (!cancelled) {
        timer = window.setTimeout(pollPaymentStatus, getPaymentPollDelay(issuedAt));
      }
    }

    timer = window.setTimeout(pollPaymentStatus, getPaymentPollDelay(issuedAt));
    return () => {
      cancelled = true;
      if (timer !== null) {
        window.clearTimeout(timer);
      }
    };
  }, [isSelectedPaymentLinkExpired, selectedPaymentLinkIssuedAt, selectedTask?.status, selectedTask?.taskId]);

  useEffect(() => {
    if (typeof window === "undefined" || !isPhoneLoggedIn || !hasResolvedInitialRoute || hasCheckedPendingPaymentRouteRef.current) {
      return;
    }

    hasCheckedPendingPaymentRouteRef.current = true;
    if (selectedTaskId) {
      return;
    }

    const pendingTaskId = window.sessionStorage.getItem(PENDING_PAYMENT_TASK_STORAGE_KEY);
    if (!pendingTaskId) {
      return;
    }

    updateSelectedTask(pendingTaskId);
    setPendingPaymentTaskId(pendingTaskId);
  }, [hasResolvedInitialRoute, isPhoneLoggedIn, selectedTaskId]);

  useEffect(() => {
    if (!isPhoneLoggedIn || !hasCurrentUserSyncableTasks) {
      return;
    }

    const timer = window.setInterval(() => {
      void syncHeartbeat({ silent: true });
    }, AUTO_REFRESH_INTERVAL_MS);

    return () => {
      window.clearInterval(timer);
    };
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

  useEffect(() => {
    if (!toastMessage) {
      return;
    }

    const timer = window.setTimeout(() => setToastMessage(null), 2200);
    return () => window.clearTimeout(timer);
  }, [toastMessage]);

  useEffect(() => {
    return () => {
      if (downloadStartResetTimerRef.current) {
        window.clearTimeout(downloadStartResetTimerRef.current);
      }
    };
  }, []);

  return (
    <main
      className={`studio-shell ${!selectedTaskId ? "home-active" : "detail-active"} ${
        marketPreview ? "market-preview-active" : ""
      } ${!isAuthLoading && !isPhoneLoggedIn ? "visitor-active" : ""} ${isSidebarCollapsed ? "sidebar-collapsed" : ""}`}
    >
      <button
        aria-label="打开菜单"
        className="mobile-menu-button"
        type="button"
        onClick={() => setIsMenuOpen(true)}
      >
        <Icon name="menu" />
        {hasUnreadSubmissionsAcrossTasks ? <span className="mobile-menu-unread-dot" aria-label="有新投稿" /> : null}
      </button>

      <AppToast message={toastMessage} />

      <AppConfirmDialog
        open={Boolean(selectConfirmation)}
        title="确认采用这个投稿吗？"
        description="确认后，系统将按此结果进行结算"
        confirmLabel="确认采用"
        cancelLabel="再看看"
        isConfirming={Boolean(selectingSubmissionId)}
        onCancel={() => setSelectConfirmation(null)}
        onConfirm={() => {
          if (!selectConfirmation) {
            return;
          }
          void selectSubmission(selectConfirmation.taskId, selectConfirmation.submissionId);
        }}
      />

      <AppNoticeDialog
        open={isPaymentSuccessNoticeOpen}
        title="恭喜发布成功"
        description={
          <>
            付款完成，任务已成功进入提交期。
            <br />
            您可以坐等创作者的投稿啦。
          </>
        }
        confirmLabel="知道了"
        onConfirm={() => setIsPaymentSuccessNoticeOpen(false)}
      />

      {isMenuOpen ? <button className="drawer-backdrop" aria-label="关闭菜单" type="button" onClick={() => setIsMenuOpen(false)} /> : null}

      <aside className={`studio-sidebar ${isMenuOpen ? "open" : ""}`}>
        <div className="studio-brand-block">
          <Link
            className="studio-brand"
            data-sidebar-tooltip="首页"
            href="/"
            onClick={() => {
              updateSelectedTask(null);
              setIsMenuOpen(false);
            }}
          >
            <img className="brand-logo-image brand-logo-wordmark" src="/logo.svg" alt="AICHONG" />
            <img className="brand-logo-image brand-logo-mark" src="/logo-mark.svg" alt="" aria-hidden="true" />
          </Link>
          <button
            aria-label={isSidebarCollapsed ? "展开侧栏" : "收起侧栏"}
            className="sidebar-collapse-button"
            data-sidebar-tooltip={isSidebarCollapsed ? "展开" : "收起"}
            type="button"
            onClick={() => setIsSidebarCollapsed((collapsed) => !collapsed)}
          >
            <Icon name={isSidebarCollapsed ? "sidebarExpand" : "sidebarCollapse"} />
          </button>
          <button className="drawer-close sidebar-close" aria-label="收起侧栏" type="button" onClick={() => setIsMenuOpen(false)}>
            <Icon name="sidebarCollapse" />
          </button>
        </div>

        <nav className="studio-menu">
          <button
            className={!selectedTaskId ? "active" : ""}
            data-sidebar-tooltip="发布新任务"
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
                      if (selectedTaskId === task.taskId) {
                        markTaskSubmissionsRead(task.taskId);
                      }
                      updateSelectedTask(task.taskId);
                      setIsMenuOpen(false);
                    }}
                    type="button"
                  >
                    <span className="sidebar-task-title">{getDisplayTaskDescription(task.description)}</span>
                    <span className="sidebar-task-meta">
                      <span className="sidebar-task-submission-count">
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
          <Link href="/market-rules" target="_blank" rel="noreferrer" data-sidebar-tooltip="市场规则" onClick={() => setIsMenuOpen(false)}>
            <span className="nav-icon-slot">
              <Icon name="rules" />
            </span>
            <span className="sidebar-label">市场规则</span>
          </Link>
          <Link href="/work" target="_blank" rel="noreferrer" data-sidebar-tooltip="我要接单" onClick={() => setIsMenuOpen(false)}>
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
              <button
                className="account-trigger"
                data-sidebar-tooltip={maskPhone(currentUser.phone)}
                type="button"
                onClick={() => setIsAccountMenuOpen((open) => !open)}
              >
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
        <button
          className="studio-login-button"
          type="button"
          onClick={() => {
            if (isLoginOpen) {
              closeLoginModal();
            } else {
              openLoginModal();
            }
          }}
        >
          登录/注册
        </button>
      ) : null}

      {isLoginOpen && !isPhoneLoggedIn ? (
        <div className="modal-layer">
          <div className="modal-backdrop login-backdrop" aria-hidden="true" />
          <section className="login-modal" role="dialog" aria-modal="true" aria-labelledby="login-title">
            <div className="modal-header">
              <div>
                <h2 id="login-title">登录/注册</h2>
                <p>登录后可以发布任务、查看投稿和历史任务。</p>
              </div>
              <button aria-label="关闭登录弹窗" type="button" onClick={closeLoginModal}>
                <Icon name="close" />
              </button>
            </div>
            <form className="modal-login-form" onSubmit={loginWithPhoneCode}>
              <label>
                手机号
                <span className="phone-input-wrap">
                  <input
                    aria-label="手机号"
                    maxLength={11}
                    inputMode="tel"
                    placeholder="请输入手机号"
                    value={loginPhone}
                    onChange={(event) => {
                      setLoginPhone(event.target.value.replace(/\D/g, "").slice(0, 11));
                      setLoginCode("");
                      setLoginError(null);
                      setCodeCooldown(0);
                    }}
                    required
                  />
                  {loginPhone ? (
                    <button
                      className="phone-clear-button"
                      aria-label="清空手机号"
                      type="button"
                      onClick={() => {
                        resetLoginForm({ clearPhone: true });
                      }}
                    >
                      ×
                    </button>
                  ) : null}
                </span>
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
                    onChange={(event) => {
                      setLoginCode(event.target.value.replace(/\D/g, "").slice(0, 6));
                      setLoginError(null);
                    }}
                    required
                  />
                  <button type="button" onClick={sendLoginCode} disabled={!canSendCode}>
                    {isSendingCode ? "发送中" : codeCooldown > 0 ? `${codeCooldown}s后重新发送` : "获取验证码"}
                  </button>
                </span>
              </label>
              {loginError ? <div className="login-inline-message error">{loginError}</div> : null}
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

      <section className="studio-content" onScroll={syncCompactComposerVisibility}>
        {!hasResolvedInitialRoute ? (
          <section className="detail-stage">
            <div className="content-body">
              <div className="detail-loading-state" role="status" aria-label="正在读取页面">
                <HeartbeatLoadingIcon />
              </div>
            </div>
          </section>
        ) : !selectedTaskId ? (
          <div className="studio-home">
            <section className="home-entry-panel">
              <div className="home-hero-intro">
                <h1>今天想做点什么？</h1>
              </div>

              <div className="home-publish-layout">
                <div className="home-composer-column">
                  <form className="hero-task-card studio-composer home-composer" ref={homeComposerFormRef} onSubmit={createTask} noValidate>
                    <div className="form-body">
                      {attachments.length > 0 ? (
                        <div className="composer-attachments-wrap">
                          <div className="attachment-list composer-attachments">
                            {attachments.map((attachment, index) => (
                              <div className="attachment-item is-removable" key={`${attachment.fileName}-${index}`}>
                                <AttachmentVisual attachment={attachment} file={attachment.file} />
                                <div className="attachment-copy">
                                  <strong>{repairMojibakeFileName(attachment.fileName)}</strong>
                                  <span>{formatFileSize(attachment.fileSize)}</span>
                                </div>
                                <button
                                  className="attachment-remove-button"
                                  aria-label={`删除 ${attachment.fileName}`}
                                  type="button"
                                  onClick={() => removeAttachment(index)}
                                >
                                  <Icon name="close" />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}

                      <label className="textarea-field" htmlFor="description">
                        <textarea
                          id="description"
                          ref={descriptionTextareaRef}
                          aria-label="任务说明"
                          value={description}
                          onChange={(event) => {
                            const nextDescription = event.target.value;
                            setDescription(nextDescription);
                            if (error === DESCRIPTION_TOO_SHORT_ERROR && nextDescription.trim().length >= MIN_DESCRIPTION_LENGTH) {
                              setError(null);
                            }
                          }}
                          onFocus={() => setIsComposerFocused(true)}
                          onBlur={() => setIsComposerFocused(false)}
                          placeholder="说说你想做什么，比如风格、要求、字数、时长或用在什么场景等，描述越具体，成果越符合预期"
                          disabled={isCreating}
                        />
                      </label>

                      <div className="task-card-controls">
                        <div
                          className={`attachment-control-group ${isAttachmentTooltipSuppressed ? "is-tooltip-suppressed" : ""}`}
                          onMouseLeave={() => setIsAttachmentTooltipSuppressed(false)}
                          onBlur={(event) => {
                            if (!event.currentTarget.contains(event.relatedTarget)) {
                              setIsAttachmentTooltipSuppressed(false);
                            }
                          }}
                        >
                          <label
                            className="attachment-control"
                            htmlFor="attachments"
                            aria-label="上传附件"
                            aria-describedby={ATTACHMENT_RULE_TOOLTIP_ID}
                            onClick={(event) => {
                              setIsAttachmentTooltipSuppressed(true);
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
                                setIsAttachmentTooltipSuppressed(true);
                                if (!isPhoneLoggedIn) {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  setError(null);
                                  setMessage(null);
                                  setIsLoginOpen(true);
                                }
                              }}
                              onChange={(event) => {
                                const input = event.currentTarget;
                                if (!isPhoneLoggedIn) {
                                  input.value = "";
                                  input.blur();
                                  setError(null);
                                  setMessage(null);
                                  setIsLoginOpen(true);
                                  return;
                                }
                                addAttachments(input.files);
                                input.value = "";
                                input.blur();
                              }}
                            />
                          </label>
                          <span className="attachment-rule-tooltip" id={ATTACHMENT_RULE_TOOLTIP_ID} role="tooltip">
                            {ATTACHMENT_RULE_COPY}
                            <br />
                            {ATTACHMENT_LIMIT_COPY}
                          </span>
                        </div>
                        <div className="budget-control-group">
                          <label className="budget-control" htmlFor="price" aria-describedby="price-rule-tooltip">
                            ¥
                            <input
                              id="price"
                              inputMode="decimal"
                              min="1"
                              max="100"
                              step="0.1"
                              type="text"
                              name="aichong-task-budget"
                              autoComplete="off"
                              value={price}
                              placeholder="1-100"
                              onBlur={normalizePriceInput}
                              onChange={(event) => {
                                updatePriceInput(event.target.value);
                                if (error === PRICE_INVALID_ERROR) {
                                  setError(null);
                                }
                              }}
                              disabled={isCreating}
                            />
                          </label>
                          <span className="budget-rule-tooltip" id="price-rule-tooltip" role="tooltip">
                            平台客单价 1-100 元
                            <br />
                            通常报酬越高，越能收到更多投稿
                          </span>
                        </div>
                        <button className="publish-button" type="submit" disabled={isPublishDisabled}>
                          {isCreating ? "发布中" : "发布任务 →"}
                        </button>
                      </div>

                      {uploadProgressText ? <div className="message neutral">{uploadProgressText}</div> : null}
                      {message ? <div className="message neutral">{message}</div> : null}
                      {error && !shouldShowComposerValidationError ? <div className="message error">{error}</div> : null}
                    </div>
                  </form>
                  {shouldShowComposerValidationError ? (
                    <div className="composer-validation-message" role="alert">
                      {error}
                    </div>
                  ) : null}
                </div>

                {marketPreview ? null : (
                  <PlatformActivityPanel activity={platformActivity} isLoading={isPlatformActivityLoading} isPaused={shouldPausePlatformActivity} />
                )}
              </div>
            </section>

            {marketPreview ? (
              <MarketHomePreviewPanel feed={marketPreview.feed} summary={marketPreview.summary} />
            ) : (
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
            )}
          </div>
        ) : (
          <section className="detail-stage">
              <div className="content-body">
                {shouldShowDetailLoadingState ? (
                  <div className="detail-loading-state" role="status" aria-label="正在读取任务详情和交付结果">
                    <HeartbeatLoadingIcon />
                  </div>
                ) : selectedTask ? (
                  <div className="detail-stack">
                    {isSyncableTaskStatus(selectedTask.status) ? (
                      <div className="detail-floating-bar">
                        <span className={`detail-refresh-meta ${autoRefreshError ? "is-error" : ""}`}>{refreshMetaText}</span>
                        <button
                          className="detail-refresh-button"
                          aria-label={autoRefreshError ? "重试刷新" : "刷新"}
                          data-tooltip={autoRefreshError ? "重试刷新" : "刷新任务"}
                          type="button"
                          onClick={() => syncHeartbeat()}
                          disabled={isDetailLoading || isSyncing}
                        >
                          <Icon name="activity" />
                        </button>
                      </div>
                    ) : null}

                    <div className="detail-card task-detail-card">
                      <div className="task-detail-header">
                        <div className="section-eyebrow">任务详情</div>
                      </div>
                      <section className="task-description-panel" aria-label="需求描述">
                        <div className="task-description-body">
                          {visibleTaskDescription}
                          {shouldCollapseTaskDescription ? (
                            <button
                              className="task-description-inline-toggle"
                              type="button"
                              onClick={() => setIsTaskDescriptionExpanded((expanded) => !expanded)}
                              aria-expanded={isTaskDescriptionExpanded}
                            >
                              <span>{isTaskDescriptionExpanded ? "收起需求" : "展开完整需求"}</span>
                              <span className="task-description-toggle-icon">
                                <Icon name="chevron" />
                              </span>
                            </button>
                          ) : null}
                        </div>
                      </section>

                      <div className="task-detail-meta-line">
                        <span className="task-price-badge">
                          <span>报酬</span>
                          <strong>¥{selectedTask.price}</strong>
                        </span>
                        {selectedTask.status === "PENDING_PAYMENT" && selectedTask.createdAt ? (
                          <>
                            <span className="task-detail-time-text">创建时间 {formatDateTimeToMinute(selectedTask.createdAt)}</span>
                            <span className="task-detail-time-text">付款截止 {formatDateTimeToMinute(addHoursToDateTime(selectedTask.createdAt, 24))}</span>
                          </>
                        ) : null}
                        {selectedTask.status === "ACTIVE" && (selectedTask.paidAt || selectedTask.createdAt) ? (
                          <span className="task-detail-time-text">发布时间 {formatDateTimeToMinute(selectedTask.paidAt || selectedTask.createdAt)}</span>
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
                                  <strong>{getAttachmentOriginalName(attachment, index)}</strong>
                                  {attachment.fileSize ? <span>{formatFileSize(attachment.fileSize)}</span> : null}
                                </div>
                                <div className="attachment-actions">
                                  <button
                                    className="attachment-download-button"
                                    aria-label={`下载 ${getAttachmentOriginalName(attachment, index)}`}
                                    type="button"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      downloadAttachment(attachment);
                                    }}
                                    disabled={downloadStartingAttachmentUrl === attachment.fileUrl}
                                  >
                                    <Icon name="download" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}

                      {selectedTask.status === "PENDING_PAYMENT" ? (
                        <div className={`payment-status-panel ${isSelectedPaymentLinkExpired ? "expired" : ""}`} role="status">
                          <div className="payment-status-copy">
                            <strong>
                              {isSelectedPaymentLinkExpired ? "支付已超时" : "等待付款完成"}
                              {selectedPaymentCountdownText ? <span>{selectedPaymentCountdownText}</span> : null}
                            </strong>
                            <p>
                              {isSelectedPaymentLinkExpired
                                ? "支付链接已超时，请重新支付。"
                                : "付款完成后，将自动更新任务状态。如付款失败，可重新支付。"}
                            </p>
                          </div>
                          <button className="payment-status-action" type="button" onClick={reopenPaymentForSelectedTask} disabled={isRefreshingPayment}>
                            {isRefreshingPayment ? "处理中" : "重新支付"}
                          </button>
                        </div>
                      ) : null}
                    </div>

                    <div className="submissions submission-section">
                      <div className="detail-header">
                        <div className="submission-heading">
                          <h3>收到投稿</h3>
                          <span className="chip">{submissions.length} 条</span>
                        </div>
                        <div className="header-actions">
                          <span className="chip submission-status-chip">{getTaskStatusLabel(selectedTask.status)}</span>
                          {selectedTask.status === "ACTIVE" && selectedTask.deadlineAt ? (
                            <span className="submission-deadline">提交期截止 {formatDateTimeToMinute(selectedTask.deadlineAt)}</span>
                          ) : null}
                          {selectedTask.status === "PENDING_SELECTION" && selectedTask.deadlineAt ? (
                            <span className="submission-deadline">选择期截止 {formatDateTimeToMinute(selectedTask.deadlineAt)}</span>
                          ) : null}
                        </div>
                      </div>

                      {selectedTaskSubmissionNotice ? (
                        <div className={`selection-reminder ${selectedTaskSubmissionNotice.tone}`} role="status">
                          <strong>{selectedTaskSubmissionNotice.title}</strong>
                          <p>{selectedTaskSubmissionNotice.body}</p>
                        </div>
                      ) : null}

                      {submissions.length > 0 ? (
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
                                      <strong>{getAttachmentOriginalName(attachment, index)}</strong>
                                      {attachment.fileSize ? <span>{formatFileSize(attachment.fileSize)}</span> : null}
                                    </div>
                                    <div className="attachment-actions">
                                      <button
                                        className="attachment-download-button"
                                        aria-label={`下载 ${getAttachmentOriginalName(attachment, index)}`}
                                        type="button"
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          downloadAttachment(attachment);
                                        }}
                                        disabled={downloadStartingAttachmentUrl === attachment.fileUrl}
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
                                  onClick={() => setSelectConfirmation({ taskId: selectedTask.taskId, submissionId: submission.submissionId })}
                                  disabled={Boolean(selectingSubmissionId) || submission.selected}
                                >
                                  {submission.selected ? "已采用" : selectingSubmissionId === submission.submissionId ? "采用中" : "采用投稿"}
                                </button>
                              </div>
                            ) : null}
                          </article>
                        ))
                      ) : (
                        <div className="empty-state submission-empty-state">
                          <span className="submission-empty-mark" aria-hidden="true" />
                          <span>{getEmptySubmissionText(selectedTask.status, selectedTask.submissionCount || 0)}</span>
                        </div>
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
      {marketPreview && !selectedTaskId && isCompactComposerVisible ? (
        <form
          ref={compactComposerFormRef}
          className="compact-publish-bar"
          onSubmit={(event) => {
            event.preventDefault();
            focusHomeComposer();
          }}
          onFocusCapture={(event) => {
            if ((event.target as HTMLElement).closest('.compact-attachment-control, input[type="file"]')) {
              return;
            }
            focusHomeComposer();
          }}
          onMouseDownCapture={(event) => {
            if ((event.target as HTMLElement).closest('.compact-attachment-control, input[type="file"]')) {
              return;
            }
            event.preventDefault();
            focusHomeComposer();
          }}
          noValidate
        >
          <label
            className="compact-attachment-control"
            htmlFor="compact-attachments"
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
              id="compact-attachments"
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
                const input = event.currentTarget;
                if (!isPhoneLoggedIn) {
                  input.value = "";
                  input.blur();
                  setError(null);
                  setMessage(null);
                  setIsLoginOpen(true);
                  return;
                }
                addAttachments(input.files);
                input.value = "";
                input.blur();
                focusHomeComposer();
              }}
            />
          </label>
          <button
            type="button"
            className={`compact-publish-field${description.trim() ? "" : " is-placeholder"}`}
            aria-label="快速发布任务说明"
            disabled={isCreating}
          >
            {description.trim() || (usesShortCompactPrompt ? "点击立即开始..." : "也想发一个需求任务？点击立即开始...")}
          </button>
          <button className="compact-publish-button" type="submit" disabled={isPublishDisabled}>
            {isCreating ? "发布中" : "发布任务 →"}
          </button>
        </form>
      ) : null}
    </main>
  );
}
