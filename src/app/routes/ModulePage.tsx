import { lazy, Suspense, useMemo } from "react";
import { Link, useParams } from "react-router-dom";

import { Pill } from "@components/ui/Pill";
import { getModuleBySlug } from "@modules/registry";

function MissingModule() {
  return (
    <section className="panel panel-hero">
      <div className="section-heading">
        <Pill tone="muted">Missing Module</Pill>
        <h1>这个模块还没有接入到 PageNest。</h1>
        <p>
          你可以先回到首页，或在 <code>src/modules/</code> 下创建一个新的模块目录。
        </p>
      </div>
      <div className="panel-actions">
        <Link className="button button-primary" to="/">
          返回首页
        </Link>
      </div>
    </section>
  );
}

export function ModulePage() {
  const { slug } = useParams();
  const moduleEntry = slug ? getModuleBySlug(slug) : undefined;

  const LazyModule = useMemo(() => {
    if (!moduleEntry) {
      return null;
    }

    return lazy(moduleEntry.load);
  }, [moduleEntry]);

  if (!moduleEntry || !LazyModule) {
    return <MissingModule />;
  }

  return (
    <Suspense
      fallback={
        <section className="panel panel-hero">
          <div className="section-heading">
            <Pill tone="accent">Loading</Pill>
            <h1>正在准备 {moduleEntry.manifest.title}</h1>
            <p>模块代码会按需加载，主壳层保持轻量。</p>
          </div>
        </section>
      }
    >
      <LazyModule />
    </Suspense>
  );
}

