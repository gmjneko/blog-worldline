import styles from './AboutPage.module.css'

const koaksUrl = 'https://github.com/koaks-ai/koaks'

export function AboutPage() {
  return (
    <article className={styles.page}>
      <section className={styles.intro} aria-labelledby="about-title">
        <div className={styles.introCopy}>
          {/*<p className={styles.eyebrow}>ABOUT / PROFILE</p>*/}
          <h1 id="about-title">
            <span className={styles.titlePrimary}>关于我</span>
            <span className={styles.titleSecondary}>/</span>
            <span className={styles.titleSecondary}>About Me</span>
          </h1>

          <div className={styles.prose}>
            <p>
              你好，来自远方的朋友！我是 <strong>GMJneko</strong>
              ，目前计算机硕士在读，喜欢折腾各种有意思的东西。
            </p>
            <p>
              在这里主要记录我的学习历程、技术积累以及一些天马行空的想法。
            </p>
            <p>
              下面是我开发的一些项目，感兴趣可以 Star 一下喵～ 🐱
            </p>
          </div>
        </div>

        <figure className={styles.portrait}>
          <div className={styles.portraitFrame}>
            <img src="/atri.png" alt="GMJneko 的头像" />
          </div>
          <figcaption>
            <span>GMJNEKO</span>
            <span>PROFILE / 2026</span>
          </figcaption>
        </figure>
      </section>

      <section className={styles.section} aria-labelledby="project-title">
        <header className={styles.sectionHeader}>
          <span>01</span>
          <p>SELECTED PROJECT</p>
        </header>

        <div className={styles.project}>
          <div>
            <h2 id="project-title">
              <a href={koaksUrl} target="_blank" rel="noreferrer">
                koaks-ai/koaks
              </a>
            </h2>
            <a
              className={styles.projectDescription}
              href={koaksUrl}
              target="_blank"
              rel="noreferrer"
            >
              An Agentic AI framework for Kotlin Multiplatform.
            </a>
          </div>

          <div className={styles.projectMeta}>
            <a href={koaksUrl} target="_blank" rel="noreferrer">
              Apache-2.0
            </a>
            <a
              className={styles.projectArrow}
              href={koaksUrl}
              target="_blank"
              rel="noreferrer"
              aria-label="在 GitHub 查看 koaks-ai/koaks"
            >
              ↗
            </a>
          </div>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="contact-title">
        <header className={styles.sectionHeader}>
          <span>02</span>
          <p>GET IN TOUCH</p>
        </header>

        <div className={styles.contact}>
          <h2 id="contact-title">联系方式</h2>

          <dl>
            <div>
              <dt>
                <span aria-hidden="true">💻</span> GitHub
              </dt>
              <dd>
                <a
                  href="https://github.com/gmjneko"
                  target="_blank"
                  rel="noreferrer"
                >
                  https://github.com/gmjneko
                </a>
              </dd>
            </div>
            <div>
              <dt>
                <span aria-hidden="true">📮</span> Email
              </dt>
              <dd>
                <a href="mailto:gemingjia0201@163.com">
                  gemingjia0201@163.com
                </a>
              </dd>
            </div>
          </dl>
        </div>
      </section>
    </article>
  )
}
