import type { CSSProperties } from "react";
import { useDeferredValue, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { Pill } from "@components/ui/Pill";
import { moduleCatalog } from "@modules/catalog";
import { useHomeDashboard } from "@features/home/useHomeDashboard";
import { formatRelativeTime } from "@shared/utils/format";

export function HomePage() {
  const { dashboard, status } = useHomeDashboard();
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);

  const filteredModules = useMemo(() => {
    const normalized = deferredQuery.trim().toLowerCase();

    if (!normalized) {
      return moduleCatalog;
    }

    return moduleCatalog.filter((moduleItem) => {
      const combinedText = [
        moduleItem.title,
        moduleItem.subtitle,
        moduleItem.description,
        moduleItem.category,
        ...moduleItem.keywords
      ]
        .join(" ")
        .toLowerCase();

      return combinedText.includes(normalized);
    });
  }, [deferredQuery]);

  return (
    <div className="page-grid">
      <section className="panel panel-hero">
        <div className="section-heading">
          <Pill tone="accent">Workspace</Pill>
          <h2>一个私人的页面工坊，不是一个公开平台。</h2>
          <p>
            这里的重点不是上传任意插件，而是把 AI 为你生成的整页功能，按模块收进一个可维护的主项目。
          </p>
        </div>
        <div className="hero-summary">
          <div>
            <span className="metric-label">模块总数</span>
            <strong>{dashboard.totals.modules}</strong>
          </div>
          <div>
            <span className="metric-label">书库条目</span>
            <strong>{dashboard.totals.libraryItems}</strong>
          </div>
          <div>
            <span className="metric-label">收藏模块</span>
            <strong>{dashboard.totals.favorites}</strong>
          </div>
          <div>
            <span className="metric-label">笔记数量</span>
            <strong>{dashboard.totals.notes}</strong>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="section-heading">
          <Pill tone="success">
            {status === "ready" ? "Live snapshot" : "Local fallback"}
          </Pill>
          <h2>模块中心</h2>
          <p>模块元数据来自代码注册表，搜索只在本地执行，不依赖后端。</p>
        </div>

        <label className="search-field">
          <span>搜索模块</span>
          <input
            onChange={(event) => {
              setQuery(event.target.value);
            }}
            placeholder="例如：reader, paper, subtitle"
            value={query}
          />
        </label>

        <div className="module-grid">
          {filteredModules.map((moduleItem) => (
            <article
              key={moduleItem.slug}
              className="module-card"
              style={
                {
                  "--module-accent": moduleItem.accent
                } as CSSProperties
              }
            >
              <div className="module-card__header">
                <span className="module-card__icon">{moduleItem.icon}</span>
                <Pill>{moduleItem.category}</Pill>
              </div>
              <div className="module-card__body">
                <h3>{moduleItem.title}</h3>
                <p className="module-card__subtitle">{moduleItem.subtitle}</p>
                <p>{moduleItem.description}</p>
              </div>
              <div className="module-card__footer">
                <Link className="button button-primary" to={`/m/${moduleItem.slug}`}>
                  打开模块
                </Link>
                <span className="module-card__status">{moduleItem.status}</span>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="panel split-panel">
        <div>
          <div className="section-heading">
            <Pill tone="muted">Recent</Pill>
            <h2>最近打开</h2>
            <p>这些信息来自 D1；数据库未连接时会自动回退到示例数据。</p>
          </div>
          <div className="activity-list">
            {dashboard.recentModules.map((moduleItem) => (
              <div key={moduleItem.slug} className="activity-item">
                <div>
                  <strong>{moduleItem.title}</strong>
                  <p>{moduleItem.summary}</p>
                </div>
                <span>{formatRelativeTime(moduleItem.openedAt)}</span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="section-heading">
            <Pill tone="muted">Infra</Pill>
            <h2>运行时状态</h2>
            <p>壳层可以在前端先跑起来，D1/R2 再逐步接入。</p>
          </div>
          <div className="status-stack">
            <div className="status-card">
              <strong>D1</strong>
              <span>{dashboard.infrastructure.d1 ? "Ready" : "Pending"}</span>
            </div>
            <div className="status-card">
              <strong>R2</strong>
              <span>{dashboard.infrastructure.r2 ? "Ready" : "Pending"}</span>
            </div>
            <div className="status-card">
              <strong>Mode</strong>
              <span>{dashboard.infrastructure.mode}</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
