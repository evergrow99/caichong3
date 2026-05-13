import Link from "next/link";

type StaticMarketNavProps = {
  active: "rules" | "work";
};

export function StaticMarketNav({ active }: StaticMarketNavProps) {
  return (
    <header className="market-topbar">
      <Link href="/" className="market-brand" aria-label="返回 AICHONG 工作台">
        <span className="market-logo-wordmark" aria-hidden="true">
          <img src="/logo.svg" alt="" />
        </span>
      </Link>
      <nav className="market-nav" aria-label="页面导航">
        <Link href="/" className="market-nav-link">
          发任务
        </Link>
        <Link href="/market-rules" className={`market-nav-link ${active === "rules" ? "active" : ""}`}>
          市场规则
        </Link>
        <Link href="/work" className={`market-nav-link ${active === "work" ? "active" : ""}`}>
          我要接单
        </Link>
      </nav>
    </header>
  );
}
