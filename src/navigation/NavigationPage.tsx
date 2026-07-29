import { useState } from 'react'
import type { NavigationSite } from './content'
import { navigationCategories } from './content'
import styles from './NavigationPage.module.css'

function getDisplayHost(url: string) {
  return new URL(url).hostname.replace(/^www\./, '')
}

function getSiteInitial(name: string) {
  return name.trim().slice(0, 1).toLocaleUpperCase()
}

function SiteIcon({ site }: { site: NavigationSite }) {
  const [failedSources, setFailedSources] = useState<string[]>([])
  const source = site.icon && !failedSources.includes(site.icon) ? site.icon : ''

  const handleError = () => {
    if (!source) return
    setFailedSources((current) =>
      current.includes(source) ? current : [...current, source],
    )
  }

  return (
    <span className={styles.iconFrame} aria-hidden="true">
      {source ? (
        <img
          src={source}
          alt=""
          width="24"
          height="24"
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={handleError}
        />
      ) : (
        <span className={styles.iconFallback}>{getSiteInitial(site.name)}</span>
      )}
    </span>
  )
}

export function NavigationPage() {
  const siteCount = navigationCategories.reduce(
    (total, category) => total + category.sites.length,
    0,
  )

  return (
    <article className={styles.page}>
      <section className={styles.intro} aria-labelledby="navigation-title">
        <div className={styles.introCopy}>
          <p className={styles.eyebrow}>DIRECTORY / CURATED LINKS</p>
          <h1 id="navigation-title">导航站</h1>
        </div>

        <dl className={styles.stats} aria-label="导航站统计">
          <div>
            <dt>分类</dt>
            <dd>{String(navigationCategories.length).padStart(2, '0')}</dd>
          </div>
          <div>
            <dt>站点</dt>
            <dd>{String(siteCount).padStart(2, '0')}</dd>
          </div>
        </dl>
      </section>

      <div className={styles.directoryLayout}>
        <aside className={styles.categoryRail}>
          <nav className={styles.categoryNav} aria-label="导航站分类">
            {navigationCategories.map((category, index) => (
              <a key={category.name} href={`#navigation-category-${index + 1}`}>
                <span>{category.name}</span>
              </a>
            ))}
          </nav>
        </aside>

        <div className={styles.categories}>
          {navigationCategories.map((category, categoryIndex) => (
            <section
              className={styles.category}
              id={`navigation-category-${categoryIndex + 1}`}
              key={category.name}
              aria-labelledby={`navigation-category-title-${categoryIndex + 1}`}
            >
              <header className={styles.categoryHeader}>
                <span className={styles.categoryNumber}>
                  {String(categoryIndex + 1).padStart(2, '0')}
                </span>
                <div>
                  <h2 id={`navigation-category-title-${categoryIndex + 1}`}>
                    {category.name}
                  </h2>
                  {category.description && <p>{category.description}</p>}
                </div>
                <span className={styles.categoryCount}>
                  {String(category.sites.length).padStart(2, '0')} LINKS
                </span>
              </header>

              <div className={styles.siteGrid}>
                {category.sites.map((site) => (
                  <a
                    className={styles.siteCard}
                    href={site.url}
                    key={`${site.name}-${site.url}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <div className={styles.cardMain}>
                      <SiteIcon site={site} />
                      <div className={styles.cardCopy}>
                        <div className={styles.cardTitle}>
                          <h3>{site.name}</h3>
                          <span className={styles.cardArrow} aria-hidden="true">
                            ↗
                          </span>
                        </div>
                        {site.description && <p>{site.description}</p>}
                      </div>
                    </div>

                    <span className={styles.siteHost}>
                      {getDisplayHost(site.url)}
                    </span>
                  </a>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </article>
  )
}
