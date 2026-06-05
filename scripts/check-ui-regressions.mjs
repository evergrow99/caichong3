import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const filesToCheck = ["components/order-console.tsx"];
const forbiddenSnippets = [
  {
    text: "已先显示本地订单",
    reason: "订单详情超时但已有本地任务可展示时，不应再弹出红色错误条。"
  }
];

const failures = [];

for (const filePath of filesToCheck) {
  const source = readFileSync(join(root, filePath), "utf8");

  for (const forbidden of forbiddenSnippets) {
    if (source.includes(forbidden.text)) {
      failures.push(`${filePath}: 禁止出现“${forbidden.text}”。${forbidden.reason}`);
    }
  }
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log("UI regression checks passed.");
