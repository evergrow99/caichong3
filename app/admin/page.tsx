import Link from "next/link";
import { revalidatePath } from "next/cache";
import { isAdminUser } from "@/lib/admin";
import { getCurrentUser } from "@/lib/current-user";
import { syncPlatformHeartbeat } from "@/lib/heartbeat-sync";
import { listOperationLogs } from "@/lib/operation-log";
import { getReadinessReport } from "@/lib/readiness";
import { listAdminOrders } from "@/lib/order-repository";
import { getTaskStatusLabel, taskStatusRules } from "@/lib/task-rules";

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

function formatDate(value?: string) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("zh-CN", {
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
    return (
      <main className="page-shell">
        <section className="panel admin-empty">
          <h1>运营后台</h1>
          <p>当前手机号没有管理员权限。请先用管理员手机号登录，再打开这个页面。</p>
          <Link className="btn primary link-button" href="/">
            返回发单工作台
          </Link>
        </section>
      </main>
    );
  }

  const [{ orders, summary }, operationLogs, readiness] = await Promise.all([listAdminOrders(), listOperationLogs(20), getReadinessReport()]);
  const actionOrders = orders.filter((order) => order.isRealCaichongTask && getOrderAction(order)).slice(0, 5);

  return (
    <main className="page-shell admin-shell">
      <header className="topbar">
        <div className="brand">
          <h1>运营后台</h1>
          <p>{user.phone} 正在查看平台全部订单，适合排查付款、投稿和结算状态。</p>
        </div>
        <Link className="btn secondary link-button" href="/">
          返回工作台
        </Link>
      </header>

      <section className="panel admin-action-bar">
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

      <section className="panel admin-panel readiness-panel">
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

      <section className="admin-metrics">
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
        <div className="metric-card">
          <span>已完成</span>
          <strong>{summary.completed}</strong>
        </div>
        <div className="metric-card">
          <span>旧测试单</span>
          <strong>{summary.legacyOrders}</strong>
        </div>
      </section>

      <section className="panel admin-panel action-orders-panel">
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

      <section className="panel admin-panel">
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

      <section className="panel admin-panel">
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

      <section className="panel admin-panel admin-log-panel">
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
    </main>
  );
}
