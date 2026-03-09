import { Pill } from "@components/ui/Pill";

export default function SubtitleWorkbenchView() {
  return (
    <div className="page-grid">
      <section className="panel panel-hero">
        <div className="section-heading">
          <Pill tone="accent">Media Module</Pill>
          <h2>Subtitle Workbench</h2>
          <p>后面可以接字幕导入、对照翻译、节奏检查和导出工具。</p>
        </div>
      </section>

      <section className="panel">
        <div className="section-heading">
          <Pill tone="muted">Draft</Pill>
          <h2>模块边界</h2>
          <p>这个模块只负责字幕内容和时间轴；存储、设置、最近使用都继续走主项目的统一壳层。</p>
        </div>
      </section>
    </div>
  );
}

