import { Pill } from "@components/ui/Pill";

export default function PaperDeskView() {
  return (
    <div className="page-grid">
      <section className="panel panel-hero">
        <div className="section-heading">
          <Pill tone="accent">Research Module</Pill>
          <h2>Paper Desk</h2>
          <p>为论文阅读保留一个独立工作台，后面可以接摘要、引用卡片和主题分组。</p>
        </div>
      </section>

      <section className="panel split-panel">
        <div>
          <div className="section-heading">
            <Pill tone="muted">Today</Pill>
            <h2>阅读流</h2>
            <p>把“打开 PDF、看摘录、记下一句话”压成一个页面里完成。</p>
          </div>
        </div>
        <div>
          <div className="section-heading">
            <Pill>Draft</Pill>
            <h2>下一步适合接什么</h2>
            <p>适合接 PDF 上传、AI 摘要、引用导出、研究标签等能力。</p>
          </div>
        </div>
      </section>
    </div>
  );
}

