import { lazy, Suspense, useMemo } from "react";
import { Link, useParams } from "react-router-dom";

import { Badge } from "@components/ui/badge";
import { Button } from "@components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from "@components/ui/card";
import { getModuleBySlug } from "@modules/registry";

function MissingModule() {
  return (
    <Card className="border-border/80 bg-card/95">
      <CardHeader className="gap-4">
        <Badge variant="outline">Missing Module</Badge>
        <div className="space-y-2">
          <CardTitle className="text-2xl">这个模块还没有接入到 PageNest。</CardTitle>
          <CardDescription>
            你可以先回到工作台，或在 <code>src/modules/</code> 下创建新的模块目录并注册。
          </CardDescription>
        </div>
      </CardHeader>
      <CardFooter>
        <Button asChild>
          <Link to="/">返回工作台</Link>
        </Button>
      </CardFooter>
    </Card>
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
        <Card className="border-border/80 bg-card/95">
          <CardHeader className="gap-4">
            <Badge variant="accent">Loading</Badge>
            <div className="space-y-2">
              <CardTitle className="text-2xl">正在准备 {moduleEntry.manifest.title}</CardTitle>
              <CardDescription>模块代码按需加载，主壳层继续保持轻量。</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="pb-8 text-sm leading-7 text-muted-foreground">
            当前正在加载对应模块视图。首次进入时会先下载该模块代码，再挂载到统一壳层中。
          </CardContent>
        </Card>
      }
    >
      <LazyModule />
    </Suspense>
  );
}
