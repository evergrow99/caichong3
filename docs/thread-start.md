# AICHONG 新线程启动页

更新时间：2026-05-28
用途：每次开新线程时先读这一页，降低记忆消耗，不靠口头重新解释。

## 最重要的三条红线

1. 钱、短信、结算、权限、生产配置，永远必须先问主人。
2. Harness 第一阶段只做安全检查，不自动触发真实付款、真实短信、真实结算。
3. Codex 可以独立整理文档和优化协作工作流，但不能借此改变产品功能和业务规则。

详细规则见：`docs/aichong-collaboration-constitution.md`

## 当前项目一句话

AICHONG 是给普通用户发布创作任务的平台。用户发单、付款、收到投稿、查看结果、选择投稿；AICHONG 负责登录、订单、同步、后台、短信提醒和风险排查。

当前阶段：真实 MVP 试运营前后。不是纯 Demo，改动必须按真实产品对待。

当前状态见：`docs/current-status.md`

## 新线程默认动作

开始任何工作前：

1. 先读本文件。
2. 再读 `docs/aichong-collaboration-constitution.md` 的红线部分。
3. 根据线程角色读取对应资料。
4. 简短说明当前理解，再开始执行。

## 按线程角色读取资料

### 普通功能线程

必读：

- `docs/thread-start.md`
- `docs/current-status.md`
- `docs/aichong-collaboration-constitution.md`
- `docs/work-plan.md`

如果涉及前台体验，再读：

- `DESIGN.md`

如果涉及市场动态，再读：

- `docs/market-dynamics-rules.md`

### 测试线程

必读：

- `docs/thread-start.md`
- `docs/current-release-test-brief.md`
- `docs/validation-checklist.md`
- `docs/release-management.md` 中“测试线程交付标准”

测试结束必须给出测试结论，不能只说“测了”。

### 上线总控线程

必读：

- `docs/thread-start.md`
- `docs/release-management.md`
- `docs/current-release-test-brief.md`
- `docs/validation-checklist.md`
- `docs/decision-log.md`

上线总控必须明确结论：可上线、需补测后上线、暂缓上线。

### 后台线程

必读：

- `docs/thread-start.md`
- `docs/current-status.md`
- `docs/aichong-collaboration-constitution.md`
- `docs/validation-checklist.md`

后台改动尤其要注意管理员权限、订单数据、短信记录、日志展示。

### Harness 线程

必读：

- `docs/thread-start.md`
- `docs/aichong-collaboration-constitution.md`
- `docs/validation-checklist.md`
- `docs/current-status.md`

第一阶段只能做安全检查，不自动触发真实付款、真实短信、真实结算。

## 线程结束时必须交代

使用模板：`docs/thread-handoff-template.md`

至少说明：

- 做了什么。
- 改了哪些文件。
- 哪些规则没有动。
- 做了哪些验证。
- 哪些没验证。
- 是否涉及钱、短信、结算、权限、生产配置。
- 下一步建议。

## 给主人的最短说明格式

```text
我这次做的是：
没有动的是：
你可以这样看结果：
还需要注意的是：
```

