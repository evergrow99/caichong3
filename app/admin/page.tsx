import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isAdminUser } from "@/lib/admin";
import { getCurrentUser } from "@/lib/current-user";
import { syncPlatformHeartbeat } from "@/lib/heartbeat-sync";
import { listOperationLogs } from "@/lib/operation-log";
import { listAdminOrderSmsReminders } from "@/lib/order-reminders";
import { getReadinessReport } from "@/lib/readiness";
import { listAdminOrders } from "@/lib/order-repository";
import { getTaskStatusLabel, taskStatusRules } from "@/lib/task-rules";
import { listAdminUsers } from "@/lib/user-profile";

type AdminOrderPreview = Awaited<ReturnType<typeof listAdminOrders>>["orders"][number];

function getOrderAction(order: { status: string; submissionCount: number }) {
  if (order.status === "PENDING_PAYMENT") {
    return "等待用户付款；创建后 24 小时未付款会关闭";
  }

  if (order.status === "ACTIVE" && order.submissionCount > 0) {
    return "提交期已有投稿，可以提前采用";
  }

  if (order.status === "PENDING_SELECTION") {
    return "选择期内需要采用投稿";
  }

  return "";
}

function getSelectionReminderLevel(order: Pick<AdminOrderPreview, "deadlineAt">) {
  if (!order.deadlineAt) return "normal";
  const deadline = new Date(order.deadlineAt);
  if (Number.isNaN(deadline.getTime())) return "normal";

  const remainingHours = (deadline.getTime() - Date.now()) / (60 * 60 * 1000);
  if (remainingHours <= 0) return "overdue";
  if (remainingHours <= 6) return "critical";
  return "normal";
}

function getSelectionReminderCopy(order: Pick<AdminOrderPreview, "deadlineAt">) {
  if (!order.deadlineAt) return "选择截止时间暂未同步，请先手动同步全部订单。";
  const deadline = new Date(order.deadlineAt);
  if (Number.isNaN(deadline.getTime())) return "选择截止时间暂未同步，请先手动同步全部订单。";

  const remainingMinutes = Math.floor((deadline.getTime() - Date.now()) / 60000);
  if (remainingMinutes <= 0) return "选择期可能已经超时，请立即同步并确认订单状态。";
  if (remainingMinutes < 60) return `距离选择截止约 ${remainingMinutes} 分钟。`;

  const remainingHours = Math.floor(remainingMinutes / 60);
  if (remainingHours < 24) return `距离选择截止约 ${remainingHours} 小时。`;

  return `选择截止 ${formatDate(order.deadlineAt)}。`;
}

function sortSelectionReminderOrders(left: AdminOrderPreview, right: AdminOrderPreview) {
  const leftDeadline = left.deadlineAt ? new Date(left.deadlineAt).getTime() : Number.MAX_SAFE_INTEGER;
  const rightDeadline = right.deadlineAt ? new Date(right.deadlineAt).getTime() : Number.MAX_SAFE_INTEGER;

  return leftDeadline - rightDeadline;
}

function getReminderTypeLabel(type: string) {
  if (type === "SUBMISSION_RECEIVED") return "新投稿";
  if (type === "SELECTION_STARTED") return "进入选择期";
  if (type === "SELECTION_DEADLINE_6H") return "截止提醒";
  return type;
}

function getReminderStatusLabel(status: string) {
  if (status === "SENT") return "已发送";
  if (status === "FAILED") return "失败";
  if (status === "PENDING") return "发送中";
  if (status === "SKIPPED") return "已跳过";
  return status;
}

function getReminderStatusClassName(status: string) {
  if (status === "SENT") return "success";
  if (status === "FAILED") return "danger-chip";
  if (status === "PENDING") return "warning-chip";
  return "";
}

function formatDate(value?: string) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

async function runPlatformHeartbeat() {
  "use server";

  const user = await getCurrentUser();
  if (!isAdminUser(user)) {
    return;
  }

  await syncPlatformHeartbeat();
  revalidatePath("/admin");
}

export default async function AdminPage() {
  const user = await getCurrentUser();

  if (!isAdminUser(user)) {
    redirect(`/admin/login?reason=${user.authMode === "phone" ? "forbidden" : "login"}`);
  }

  const [{ orders, summary }, users, operationLogs, smsReminders, readiness] = await Promise.all([
    listAdminOrders(),
    listAdminUsers(),
    listOperationLogs(20),
    listAdminOrderSmsReminders(30),
    getReadinessReport()
  ]);
  const selectionReminderOrders = orders
    .filter((order) => order.isRealCaichongTask && order.status === "PENDING_SELECTION")
    .sort(sortSelectionReminderOrders);
  const actionOrders = orders
    .filter((order) => order.isRealCaichongTask && getOrderAction(order))
    .sort((left, right) => {
      if (left.status === "PENDING_SELECTION" && right.status !== "PENDING_SELECTION") return -1;
      if (right.status === "PENDING_SELECTION" && left.status !== "PENDING_SELECTION") return 1;
      return 0;
    })
    .slice(0, 5);
  const adminNavItems = [
    { href: "#overview", label: "概览", meta: `${summary.totalOrders} 单` },
    { href: "#readiness", label: "上线检查", meta: readiness.ready ? "正常" : "待处理" },
    { href: "#users", label: "用户列表", meta: `${users.length} 人` },
    { href: "#selection-reminders", label: "采用提醒", meta: `${selectionReminderOrders.length} 条` },
    { href: "#sms-reminders", label: "短信记录", meta: `${smsReminders.length} 条` },
    { href: "#action-orders", label: "需要处理", meta: `${actionOrders.length} 条` },
    { href: "#orders", label: "全部订单", meta: `${orders.length} 条` },
    { href: "#status-rules", label: "状态规则", meta: `${taskStatusRules.length} 项` },
    { href: "#logs", label: "异常日志", meta: `${operationLogs.length} 条` }
  ];

  return (
    <main className="page-shell admin-shell">
      <header className="topbar">
        <div className="brand">
          <h1>运营后台</h1>
          <p>{user.phone} 正在查看平台全部订单，适合排查付款、投稿和结算状态。</p>
        </div>
        <Link className="btn secondary link-button" href="/" target="_blank" rel="noreferrer">
          返回工作台
        </Link>
      </header>

      <div className="admin-layout">
        <aside className="admin-sidebar" aria-label="后台菜单">
          <div className="admin-sidebar-heading">
            <strong>后台菜单</strong>
            <span>快速定位数据模块</span>
          </div>
          <nav className="admin-nav">
            {adminNavItems.map((item) => (
              <a className="admin-nav-link" href={item.href} key={item.href}>
                <span>{item.label}</span>
                <small>{item.meta}</small>
              </a>
            ))}
          </nav>
        </aside>

        <div className="admin-content">
          <section className="panel admin-action-bar" id="overview">
            <div>
              <strong>后台同步</strong>
              <p>手动触发一次平台级心跳，检查全部待处理订单和才虫事件。</p>
            </div>
            <form action={runPlatformHeartbeat}>
              <button className="btn primary" type="submit">
                立即同步全部订单
              </button>
            </form>
          </section>

          <section className="admin-metrics" aria-label="后台概览指标">
            <div className="metric-card">
              <span>真实用户</span>
              <strong>{users.length}</strong>
            </div>
            <div className="metric-card">
              <span>真实订单</span>
              <strong>{summary.totalOrders}</strong>
            </div>
            <div className="metric-card">
              <span>总金额</span>
              <strong>¥{summary.totalAmount.toFixed(2)}</strong>
            </div>
            <div className="metric-card">
              <span>待支付</span>
              <strong>{summary.pendingPayment}</strong>
            </div>
            <div className="metric-card">
              <span>进行中</span>
              <strong>{summary.active}</strong>
            </div>
            <div className="metric-card">
              <span>待选择</span>
              <strong>{summary.pendingSelection}</strong>
            </div>
            <div className="metric-card urgent-metric-card">
              <span>需提醒用户</span>
              <strong>{selectionReminderOrders.length}</strong>
            </div>
            <div className="metric-card">
              <span>已完成</span>
              <strong>{summary.completed}</strong>
            </div>
            <div className="metric-card">
              <span>旧测试单</span>
              <strong>{summary.legacyOrders}</strong>
            </div>
          </section>

          <section className="panel admin-panel readiness-panel" id="readiness">
            <div className="panel-header">
              <h2>上线健康检查</h2>
              <p>{readiness.ready ? "关键配置已准备好。" : "还有配置项需要处理，完成后再正式对外上线。"}</p>
            </div>
            <div className="readiness-grid">
              {readiness.items.map((item) => (
                <article className={`readiness-item ${item.ok ? "ok" : "warn"}`} key={item.key}>
                  <div className="readiness-title">
                    <strong>{item.label}</strong>
                    <span>{item.ok ? "正常" : "待处理"}</span>
                  </div>
                  <p>{item.detail}</p>
                  {!item.ok && item.action ? <small>{item.action}</small> : null}
                </article>
              ))}
            </div>
          </section>

          <section className="panel admin-panel admin-users-panel" id="users">
            <div className="panel-header">
              <h2>用户列表</h2>
              <p>查看真实用户的手机号、注册时间、最近登录时间和发单数量；测试账号不计入统计。</p>
            </div>

            <div className="admin-table-wrap">
              {users.length > 0 ? (
                <table className="admin-table admin-users-table">
                  <thead>
                    <tr>
                      <th>手机号</th>
                      <th>注册时间</th>
                      <th>最近登录</th>
                      <th>发单数量</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((adminUser) => (
                      <tr key={adminUser.id}>
                        <td>
                          <strong>{adminUser.phone || "-"}</strong>
                          {adminUser.displayName ? <span>{adminUser.displayName}</span> : null}
                        </td>
                        <td>{formatDate(adminUser.createdAt)}</td>
                        <td>{formatDate(adminUser.lastLoginAt)}</td>
                        <td>{adminUser.orderCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="empty-state">还没有用户数据。</div>
              )}
            </div>
          </section>

          <section className="panel admin-panel selection-reminder-panel" id="selection-reminders">
            <div className="panel-header">
              <h2>采用提醒兜底</h2>
              <p>才虫生命周期短信会发给平台代理身份；这里列出需要运营主动提醒用户采用投稿的真实订单。</p>
            </div>

            <div className="action-orders">
              {selectionReminderOrders.length > 0 ? (
                selectionReminderOrders.slice(0, 8).map((order) => (
                  <article className={`action-order selection-alert ${getSelectionReminderLevel(order)}`} key={order.id}>
                    <div>
                      <strong>需要提醒用户采用投稿</strong>
                      <p>{order.description}</p>
                      <span>用户 {order.userPhone || order.userId}</span>
                      <span>截止 {formatDate(order.deadlineAt)}</span>
                      <span>ID {order.caichongTaskId}</span>
                    </div>
                    <div className="action-order-meta">
                      <span className="chip danger-chip">{getSelectionReminderCopy(order)}</span>
                      <span className="chip">投稿 {order.submissionCount}</span>
                      <span className="chip">¥{order.price.toFixed(2)}</span>
                    </div>
                  </article>
                ))
              ) : (
                <div className="empty-state">当前没有进入选择期的真实订单。</div>
              )}
            </div>
          </section>

          <section className="panel admin-panel admin-sms-panel" id="sms-reminders">
            <div className="panel-header">
              <h2>短信提醒记录</h2>
              <p>查看最近的订单提醒短信，方便排查是否已发送、发送给谁，以及失败原因。</p>
            </div>

            <div className="admin-table-wrap">
              {smsReminders.length > 0 ? (
                <table className="admin-table admin-sms-table">
                  <thead>
                    <tr>
                      <th>提醒</th>
                      <th>用户</th>
                      <th>状态</th>
                      <th>发送时间</th>
                      <th>关联订单</th>
                      <th>错误</th>
                    </tr>
                  </thead>
                  <tbody>
                    {smsReminders.map((reminder) => (
                      <tr key={reminder.id}>
                        <td>
                          <strong>{getReminderTypeLabel(reminder.reminderType)}</strong>
                          <span>{reminder.messageText}</span>
                          {reminder.deadlineAt ? <span>截止 {formatDate(reminder.deadlineAt)}</span> : null}
                        </td>
                        <td>
                          <strong>{reminder.userPhone}</strong>
                          <span>尝试 {reminder.attemptCount} 次</span>
                        </td>
                        <td>
                          <span className={`chip ${getReminderStatusClassName(reminder.status)}`}>
                            {getReminderStatusLabel(reminder.status)}
                          </span>
                        </td>
                        <td>
                          <strong>{formatDate(reminder.sentAt || reminder.createdAt)}</strong>
                          <span>创建 {formatDate(reminder.createdAt)}</span>
                        </td>
                        <td>
                          <strong>{reminder.orderDescription || "-"}</strong>
                          <span>ID {reminder.caichongTaskId || reminder.orderId}</span>
                          {reminder.caichongSubmissionId ? <span>投稿 {reminder.caichongSubmissionId}</span> : null}
                        </td>
                        <td>{reminder.errorMessage || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="empty-state">暂时没有短信提醒记录。提醒表建好后，新投稿或选择期提醒会自动记录在这里。</div>
              )}
            </div>
          </section>

          <section className="panel admin-panel action-orders-panel" id="action-orders">
            <div className="panel-header">
              <h2>需要处理</h2>
              <p>这里优先显示真实才虫订单里最值得你关注的事项。</p>
            </div>

            <div className="action-orders">
              {actionOrders.length > 0 ? (
                actionOrders.map((order) => (
                  <article className="action-order" key={order.id}>
                    <div>
                      <strong>{getOrderAction(order)}</strong>
                      <p>{order.description}</p>
                      <span>ID {order.caichongTaskId}</span>
                    </div>
                    <div className="action-order-meta">
                      <span className="chip">{getTaskStatusLabel(order.status)}</span>
                      <span className="chip">投稿 {order.submissionCount}</span>
                      <span className="chip">¥{order.price.toFixed(2)}</span>
                    </div>
                  </article>
                ))
              ) : (
                <div className="empty-state">当前没有需要立即处理的真实订单。</div>
              )}
            </div>
          </section>

          <section className="panel admin-panel" id="orders">
            <div className="panel-header">
              <h2>全部订单</h2>
              <p>统计卡片默认只计算真实才虫订单；旧 mock 测试单会在列表里标注，不计入真实金额。</p>
            </div>

            <div className="admin-table-wrap">
              {orders.length > 0 ? (
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>订单</th>
                      <th>用户</th>
                      <th>状态</th>
                      <th>金额</th>
                      <th>投稿</th>
                      <th>更新时间</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((order) => (
                      <tr key={order.id}>
                        <td>
                          <strong>{order.description}</strong>
                          <span>ID {order.caichongTaskId}</span>
                          {!order.isRealCaichongTask ? <span className="legacy-label">旧测试单</span> : null}
                        </td>
                        <td>
                          <strong>{order.userPhone || order.userId}</strong>
                          {order.userDisplayName ? <span>{order.userDisplayName}</span> : null}
                        </td>
                        <td>
                          <span className="chip">{getTaskStatusLabel(order.status)}</span>
                        </td>
                        <td>¥{order.price.toFixed(2)}</td>
                        <td>{order.submissionCount}</td>
                        <td>{formatDate(order.updatedAt || order.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="empty-state">还没有订单数据。</div>
              )}
            </div>
          </section>

          <section className="panel admin-panel" id="status-rules">
            <div className="panel-header">
              <h2>状态规则对照</h2>
              <p>按才虫公开规则整理，前台展示、采用投稿、自动刷新都应以这里为准。</p>
            </div>

            <div className="readiness-grid status-rule-grid">
              {taskStatusRules.map((rule) => (
                <article className="readiness-item" key={rule.status}>
                  <div className="readiness-title">
                    <strong>{rule.label}</strong>
                    <span>{rule.isTerminal ? "终态" : "可同步"}</span>
                  </div>
                  <p>{rule.userMeaning}</p>
                  <small>{rule.timeRule}</small>
                  <small>{rule.userAction}</small>
                </article>
              ))}
            </div>
          </section>

          <section className="panel admin-panel admin-log-panel" id="logs">
            <div className="panel-header">
              <h2>异常与同步日志</h2>
              <p>这里记录发单、附件上传、心跳同步等关键动作的失败信息。日志表建好后会自动出现。</p>
            </div>

            <div className="admin-table-wrap">
              {operationLogs.length > 0 ? (
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>时间</th>
                      <th>级别</th>
                      <th>范围</th>
                      <th>任务</th>
                      <th>信息</th>
                    </tr>
                  </thead>
                  <tbody>
                    {operationLogs.map((log) => (
                      <tr key={log.id}>
                        <td>{formatDate(log.createdAt)}</td>
                        <td>
                          <span className={`chip ${log.level === "error" ? "danger-chip" : ""}`}>{log.level}</span>
                        </td>
                        <td>{log.scope}</td>
                        <td>{log.caichongTaskId || "-"}</td>
                        <td>
                          <strong>{log.message}</strong>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="empty-state">暂时没有异常日志。若还没执行 `0002_operation_logs.sql`，这里会先保持为空。</div>
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
