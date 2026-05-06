import type { AgentEvent, Attachment, PublishTask, PublishTaskInput, Submission } from "@/lib/caichong";

type MockState = {
  tasks: PublishTask[];
  submissionsByTaskId: Record<string, Submission[]>;
  events: AgentEvent[];
  nextEventId: number;
};

const globalForMock = globalThis as typeof globalThis & {
  __caichongMockState?: MockState;
};

function nowText() {
  return new Date().toLocaleString("zh-CN", {
    hour12: false
  });
}

function addHours(hours: number) {
  const date = new Date();
  date.setHours(date.getHours() + hours);
  return date.toLocaleString("zh-CN", {
    hour12: false
  });
}

function createSeedState(): MockState {
  const taskId = "mock-task-001";

  return {
    tasks: [
      {
        taskId,
        description: "示例任务：帮我写 3 条小红书护肤种草文案，语气自然，面向 25-35 岁女性。",
        price: 19.9,
        status: "PENDING_SELECTION",
        createdAt: nowText(),
        deadlineAt: addHours(24),
        paymentUrl: "https://www.caichong.net/mock-payment/mock-task-001",
        attachments: [],
        submissionCount: 2
      }
    ],
    events: [
      {
        id: 1,
        type: "SUBMISSION_RECEIVED",
        taskId,
        payload: {
          submissionId: "mock-submission-001",
          contentSummary: "3 条小红书种草文案，覆盖真实体验、成分科普、通勤场景。"
        },
        read: false,
        createdAt: new Date().toISOString()
      }
    ],
    nextEventId: 2,
    submissionsByTaskId: {
      [taskId]: [
        {
          submissionId: "mock-submission-001",
          taskId,
          agentId: "agent-copywriter-01",
          agentName: "种草文案 Agent",
          content:
            "已完成 3 条小红书文案：第一条偏真实体验，第二条偏成分科普，第三条偏通勤场景。整体语气自然，避免了夸张承诺。",
          contentSummary: "3 条小红书种草文案，覆盖真实体验、成分科普、通勤场景。",
          createdAt: nowText(),
          selected: false,
          status: "submitted"
        },
        {
          submissionId: "mock-submission-002",
          taskId,
          agentId: "agent-brand-02",
          agentName: "品牌表达 Agent",
          content:
            "给出了一版更偏品牌调性的文案方案，包含标题、正文和评论区引导话术，适合直接进入人工微调。",
          contentSummary: "偏品牌调性的标题、正文、评论区引导话术。",
          createdAt: nowText(),
          selected: false,
          status: "submitted"
        }
      ]
    }
  };
}

function getState() {
  if (!globalForMock.__caichongMockState) {
    globalForMock.__caichongMockState = createSeedState();
  }

  return globalForMock.__caichongMockState;
}

function findTask(taskId: string) {
  const task = getState().tasks.find((item) => item.taskId === taskId);

  if (!task) {
    throw new Error(`MOCK_NOT_FOUND: 未找到模拟任务 ${taskId}`);
  }

  return task;
}

export const mockCaichong = {
  createTask(input: PublishTaskInput) {
    const state = getState();
    const taskId = `mock-task-${String(state.tasks.length + 1).padStart(3, "0")}`;
    const task: PublishTask = {
      taskId,
      description: input.description,
      price: input.price,
      status: "PENDING_PAYMENT",
      createdAt: nowText(),
      deadlineAt: addHours(24),
      paymentUrl: `https://www.caichong.net/mock-payment/${taskId}`,
      attachments: input.attachments || [],
      submissionCount: 0
    };

    state.tasks.unshift(task);
    state.submissionsByTaskId[taskId] = [];
    state.events.push({
      id: state.nextEventId,
      type: "TASK_ACTIVE",
      taskId,
      payload: {
        message: "模拟支付成功，任务进入提交期",
        deadline: addHours(72)
      },
      read: false,
      createdAt: new Date().toISOString()
    });
    state.nextEventId += 1;

    return Promise.resolve(task);
  },
  listTasks(input: { page?: number; pageSize?: number } = {}) {
    const page = input.page || 1;
    const pageSize = input.pageSize || 20;
    const state = getState();
    const start = (page - 1) * pageSize;
    const tasks = state.tasks.slice(start, start + pageSize);

    return Promise.resolve({
      tasks,
      total: state.tasks.length,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(state.tasks.length / pageSize))
    });
  },
  getTask(taskId: string) {
    return Promise.resolve(findTask(taskId));
  },
  getSubmissions(taskId: string) {
    findTask(taskId);
    return Promise.resolve({
      submissions: getState().submissionsByTaskId[taskId] || []
    });
  },
  selectSubmission(taskId: string, submissionId: string) {
    const task = findTask(taskId);
    const submissions = getState().submissionsByTaskId[taskId] || [];
    const target = submissions.find((submission) => submission.submissionId === submissionId);

    if (!target) {
      throw new Error(`MOCK_NOT_FOUND: 未找到模拟投稿 ${submissionId}`);
    }

    for (const submission of submissions) {
      submission.selected = submission.submissionId === submissionId;
      submission.status = submission.selected ? "approved" : "rejected";
    }

    task.status = "COMPLETED";
    task.submissionCount = submissions.length;

    return Promise.resolve(task);
  },
  getPaymentUrl(taskId: string) {
    const task = findTask(taskId);
    task.paymentUrl = `https://www.caichong.net/mock-payment/${taskId}?refresh=${Date.now()}`;

    return Promise.resolve({
      paymentUrl: task.paymentUrl,
      expiresInMinutes: 30
    });
  },
  listEvents(input: { page?: number; pageSize?: number } = {}) {
    const page = input.page || 1;
    const pageSize = input.pageSize || 20;
    const unreadEvents = getState().events.filter((event) => !event.read);
    const start = (page - 1) * pageSize;
    const events = unreadEvents.slice(start, start + pageSize);

    return Promise.resolve({
      events,
      total: unreadEvents.length,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(unreadEvents.length / pageSize))
    });
  },
  ackEvents(eventIds: number[]) {
    const state = getState();
    for (const event of state.events) {
      if (eventIds.includes(event.id)) {
        event.read = true;
      }
    }

    return Promise.resolve({ ok: true });
  },
  addDemoSubmission(taskId: string, attachments: Attachment[] = []) {
    const task = findTask(taskId);
    const state = getState();
    const submissions = state.submissionsByTaskId[taskId] || [];
    const submission: Submission = {
      submissionId: `mock-submission-${String(submissions.length + 1).padStart(3, "0")}`,
      taskId,
      agentName: "演示 Agent",
      content: "这是本地模拟新增的投稿，用来测试投稿列表和选中结算流程。",
      contentSummary: "本地模拟投稿",
      attachments,
      createdAt: nowText(),
      selected: false,
      status: "submitted"
    };

    submissions.push(submission);
    state.submissionsByTaskId[taskId] = submissions;
    task.status = "PENDING_SELECTION";
    task.submissionCount = submissions.length;

    return Promise.resolve(submission);
  }
};
