import { Pill } from "@components/ui/Pill";

import styles from "@modules/ebook-reader/view.module.css";

export default function EbookReaderView() {
  return (
    <div className={styles.page}>
      <section className="panel panel-hero">
        <div className="section-heading">
          <Pill tone="accent">Reader Module</Pill>
          <h2>Ebook Reader</h2>
          <p>
            这个模块的职责很单一：读取你的书库、展示最近阅读、记录进度和摘录。它不关心别的页面模块怎么工作。
          </p>
        </div>
      </section>

      <section className={styles.hero}>
        <div className="panel">
          <div className="section-heading">
            <Pill>Library</Pill>
            <h2>最近书架</h2>
          </div>
          <div className={styles.coverShelf}>
            <article className={styles.coverCard}>
              <span>EPUB</span>
              <strong>Designing Data-Intensive Applications</strong>
              <small>84% complete</small>
            </article>
            <article className={styles.coverCard}>
              <span>PDF</span>
              <strong>The Nature of Code</strong>
              <small>42% complete</small>
            </article>
            <article className={styles.coverCard}>
              <span>EPUB</span>
              <strong>The Creative Act</strong>
              <small>Recently imported</small>
            </article>
          </div>
        </div>

        <aside className="panel">
          <div className="section-heading">
            <Pill tone="muted">Progress</Pill>
            <h2>阅读状态</h2>
          </div>
          <div className={styles.stats}>
            <div>
              <span>Active reading session</span>
              <strong>3 books</strong>
            </div>
            <div>
              <span>Highlights captured</span>
              <strong>128 notes</strong>
            </div>
            <div>
              <span>Storage strategy</span>
              <strong>Files in R2, state in D1</strong>
            </div>
          </div>
        </aside>
      </section>

      <section className={styles.split}>
        <div className="panel">
          <div className="section-heading">
            <Pill tone="muted">Queue</Pill>
            <h2>继续阅读</h2>
          </div>
          <div className={styles.list}>
            <div className={styles.row}>
              <div>
                <strong>Designing Data-Intensive Applications</strong>
                <p>Chapter 8 · Continue from page 271</p>
              </div>
              <span>22 min ago</span>
            </div>
            <div className={styles.row}>
              <div>
                <strong>The Nature of Code</strong>
                <p>Vector motion notes and sketch references</p>
              </div>
              <span>1 hr ago</span>
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="section-heading">
            <Pill tone="muted">Notes</Pill>
            <h2>摘录面板</h2>
          </div>
          <div className={styles.list}>
            <div className={styles.row}>
              <div>
                <strong>“Latency numbers every programmer should know”</strong>
                <p>Tag: distributed systems</p>
              </div>
            </div>
            <div className={styles.row}>
              <div>
                <strong>“A cache invalidation story”</strong>
                <p>Tag: architecture</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

