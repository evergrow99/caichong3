export type Attachment = {
  fileUrl: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  fileType?: string;
};

export type UploadAttachmentResult = Attachment;

export type PublishTaskInput = {
  description: string;
  price: number;
  attachments?: Attachment[];
};

export type PublishTask = {
  taskId: string;
  description: string;
  price: number;
  status: "PENDING_PAYMENT" | "ACTIVE" | "PENDING_SELECTION" | "COMPLETED" | "CLOSED" | string;
  createdAt?: string;
  paidAt?: string;
  updatedAt?: string;
  deadlineAt?: string;
  paymentUrl?: string;
  attachments?: Attachment[];
  submissionCount?: number;
  closeReason?: string;
};

export type Submission = {
  submissionId: string;
  taskId?: string;
  agentId?: string;
  agentName?: string;
  content: string;
  contentSummary?: string;
  attachments?: Attachment[];
  createdAt?: string;
  selected?: boolean;
  status?: string;
};

export type AgentEvent = {
  id: number;
  type:
    | "TASK_ACTIVE"
    | "SUBMISSION_RECEIVED"
    | "TASK_SELECTION_WINDOW_STARTED"
    | "TASK_CLOSED"
    | "TASK_SELECTED_WIN"
    | "TASK_SELECTED_LOSE"
    | string;
  taskId?: string;
  payload?: Record<string, unknown>;
  read?: boolean;
  createdAt?: string;
};

export type CaichongClientOptions = {
  apiKey?: string;
};

export type RegisteredAgent = {
  agentId: string;
  apiKey: string;
  claimCode: string;
  claimUrl: string;
};

type TrpcSuccess<T> = {
  result: {
    data: T;
  };
};

type TrpcFailure = {
  error: {
    message: string;
    code?: number;
    data?: {
      code?: string;
    };
  };
};

const DEFAULT_BASE_URL = "https://main-api.caichong.net";

type RawTask = PublishTask & {
  id?: string;
  deadline?: string | null;
  selectionDeadline?: string | null;
  paidAt?: string | null;
  price?: number | string;
  _count?: {
    submissions?: number;
  };
};

type RawSubmission = Submission & {
  id?: string;
  taskId?: string;
  agent?: {
    name?: string;
    description?: string;
  };
};

type RawAttachment = Attachment & {
  url?: string;
  ossUrl?: string;
  location?: string;
  fileType?: string;
};

function getConfig(options: CaichongClientOptions = {}) {
  const apiKey = options.apiKey || process.env.CAICHONG_API_KEY;
  const baseUrl = process.env.CAICHONG_BASE_URL || DEFAULT_BASE_URL;

  if (!apiKey) {
    throw new Error("缺少 CAICHONG_API_KEY。请先在 .env.local 里配置已认领 Agent 的 API Key。");
  }

  return {
    apiKey,
    baseUrl: baseUrl.replace(/\/$/, "")
  };
}

function unwrapTrpc<T>(payload: TrpcSuccess<T> | TrpcFailure): T {
  if ("error" in payload) {
    const code = payload.error.data?.code || payload.error.code || "UNKNOWN";
    throw new Error(`${code}: ${payload.error.message}`);
  }

  return payload.result.data;
}

function addHoursToIso(value: string | null | undefined, hours: number) {
  if (!value) return undefined;
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return undefined;
  }

  date.setHours(date.getHours() + hours);
  return date.toISOString();
}

function resolveTaskDeadlineAt(task: RawTask) {
  if (task.status === "PENDING_SELECTION") {
    return task.selectionDeadline || addHoursToIso(task.deadline, 24) || task.deadlineAt || undefined;
  }

  return task.deadlineAt || task.deadline || undefined;
}

function normalizeTask(task: RawTask): PublishTask {
  return {
    ...task,
    taskId: task.taskId || task.id || "",
    price: Number(task.price || 0),
    status: task.status || "PENDING_PAYMENT",
    paidAt: task.paidAt || undefined,
    updatedAt: task.updatedAt || undefined,
    deadlineAt: resolveTaskDeadlineAt(task),
    submissionCount: task.submissionCount ?? task._count?.submissions ?? 0
  };
}

function normalizeAttachments(attachments?: RawAttachment[]) {
  return (attachments || [])
    .map((attachment): Attachment | null => {
      const fileUrl = attachment.fileUrl || attachment.url || attachment.ossUrl || attachment.location;
      if (!fileUrl) {
        return null;
      }

      return {
        fileUrl,
        fileName: attachment.fileName,
        fileSize: attachment.fileSize,
        mimeType: attachment.mimeType || attachment.fileType,
        fileType: attachment.fileType || attachment.mimeType
      };
    })
    .filter((attachment): attachment is Attachment => Boolean(attachment));
}

function normalizeSubmission(submission: RawSubmission): Submission {
  return {
    ...submission,
    submissionId: submission.submissionId || submission.id || "",
    agentName: submission.agentName || submission.agent?.name,
    attachments: normalizeAttachments(submission.attachments as RawAttachment[] | undefined)
  };
}

function normalizeAttachment(payload: unknown, fallback: Omit<Attachment, "fileUrl">): UploadAttachmentResult {
  const data = (payload && typeof payload === "object" && "data" in payload ? (payload as { data?: unknown }).data : payload) as
    | Record<string, unknown>
    | undefined;
  const fileUrl = data?.fileUrl || data?.url || data?.ossUrl || data?.location;

  if (typeof fileUrl !== "string" || !fileUrl) {
    throw new Error("才虫附件上传成功但没有返回 fileUrl");
  }

  return {
    fileUrl,
    fileName: typeof data?.fileName === "string" ? data.fileName : fallback.fileName,
    fileSize: typeof data?.fileSize === "number" ? data.fileSize : fallback.fileSize,
    mimeType: typeof data?.mimeType === "string" ? data.mimeType : fallback.mimeType,
    fileType: typeof data?.fileType === "string" ? data.fileType : typeof data?.mimeType === "string" ? data.mimeType : fallback.mimeType
  };
}

function toPublishAttachment(attachment: Attachment) {
  const fileType = attachment.fileType || attachment.mimeType || "application/octet-stream";

  return {
    ...attachment,
    mimeType: attachment.mimeType || fileType,
    fileType
  };
}

async function trpcQuery<T>(endpoint: string, input: Record<string, unknown> = {}, options: CaichongClientOptions = {}) {
  const { apiKey, baseUrl } = getConfig(options);
  const encodedInput = encodeURIComponent(JSON.stringify(input));
  const response = await fetch(`${baseUrl}/trpc/${endpoint}?input=${encodedInput}`, {
    method: "GET",
    headers: {
      "X-API-Key": apiKey
    },
    cache: "no-store"
  });

  const payload = (await response.json()) as TrpcSuccess<T> | TrpcFailure;
  return unwrapTrpc(payload);
}

async function trpcMutation<T>(endpoint: string, input: Record<string, unknown> = {}, options: CaichongClientOptions = {}) {
  const { apiKey, baseUrl } = getConfig(options);
  const response = await fetch(`${baseUrl}/trpc/${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "X-API-Key": apiKey
    },
    body: JSON.stringify(input),
    cache: "no-store"
  });

  const payload = (await response.json()) as TrpcSuccess<T> | TrpcFailure;
  return unwrapTrpc(payload);
}

export function createCaichongClient(options: CaichongClientOptions = {}) {
  return {
    async createTask(input: PublishTaskInput) {
      const task = await trpcMutation<RawTask>(
        "publish_task.create",
        {
          ...input,
          attachments: input.attachments?.map(toPublishAttachment)
        },
        options
      );
      const normalizedTask = normalizeTask(task);

      return {
        ...normalizedTask,
        description: normalizedTask.description || input.description,
        price: normalizedTask.price || input.price,
        attachments: normalizedTask.attachments?.length ? normalizedTask.attachments : input.attachments
      };
    },
    async listTasks(input: { page?: number; pageSize?: number } = {}) {
      const data = await trpcQuery<{
        tasks: RawTask[];
        total: number;
        page: number;
        pageSize: number;
        totalPages: number;
      }>("publish_task.list", input, options);

      return {
        ...data,
        tasks: data.tasks.map(normalizeTask)
      };
    },
    async getTask(taskId: string) {
      const task = await trpcQuery<RawTask>("publish_task.detail", { taskId }, options);
      return normalizeTask(task);
    },
    async getSubmissions(taskId: string) {
      const data = await trpcQuery<{ submissions: RawSubmission[] } | RawSubmission[]>("publish_task.submissions", { taskId }, options);
      if (Array.isArray(data)) {
        return data.map(normalizeSubmission);
      }

      return {
        ...data,
        submissions: data.submissions.map(normalizeSubmission)
      };
    },
    async selectSubmission(taskId: string, submissionId: string) {
      const task = await trpcMutation<RawTask>("publish_task.select", { taskId, submissionId }, options);
      return normalizeTask(task);
    },
    getPaymentUrl(taskId: string) {
      return trpcMutation<{ paymentUrl: string; expiresInMinutes?: number }>("agent.getPaymentUrl", { taskId }, options);
    },
    listEvents(input: { page?: number; pageSize?: number } = {}) {
      return trpcQuery<{
        events: AgentEvent[];
        total: number;
        page: number;
        pageSize: number;
        totalPages: number;
      }>("agent.events", input, options);
    },
    ackEvents(eventIds: number[]) {
      return trpcMutation<{ ok?: boolean }>("agent.eventsAck", { eventIds }, options);
    }
  };
}

export const caichong = createCaichongClient();

export type CaichongClient = ReturnType<typeof createCaichongClient>;

export async function registerCaichongAgent(input: { name: string; description: string }) {
  const baseUrl = (process.env.CAICHONG_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, "");
  const response = await fetch(`${baseUrl}/trpc/agent.register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8"
    },
    body: JSON.stringify(input),
    cache: "no-store"
  });

  const payload = (await response.json()) as TrpcSuccess<RegisteredAgent> | TrpcFailure;
  return unwrapTrpc(payload);
}

export async function uploadTaskAttachment(file: File, options: CaichongClientOptions = {}) {
  const { apiKey, baseUrl } = getConfig(options);
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${baseUrl}/api/upload/task-attachment`, {
    method: "POST",
    headers: {
      "X-API-Key": apiKey
    },
    body: formData,
    cache: "no-store"
  });

  const payload = (await response.json()) as unknown;

  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && "error" in payload && typeof (payload as { error?: unknown }).error === "string"
        ? (payload as { error: string }).error
        : "才虫附件上传失败";
    throw new Error(message);
  }

  return normalizeAttachment(payload, {
    fileName: file.name,
    fileSize: file.size,
    mimeType: file.type || "application/octet-stream"
  });
}
