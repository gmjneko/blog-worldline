import { useMemo, useState } from 'react'
import { PostCard, SearchBar, posts } from './blog'
import { PageShell, SiteFooter, SiteHeader } from './ui'
import './App.css'

const navigation = [
  { href: '#articles', label: '文章', active: true },
  { href: '#notes', label: '随记' },
  { href: '#projects', label: '项目' },
  { href: '#about', label: '关于' },
]

function RssIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <circle cx="3.25" cy="12.75" r="1" />
      <path d="M3 7.25a5.75 5.75 0 0 1 5.75 5.75M3 3a10 10 0 0 1 10 10" />
    </svg>
  )
}

function App() {
  const [query, setQuery] = useState('')

  const filteredPosts = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase()
    if (!normalizedQuery) return posts

    return posts.filter((post) =>
      [post.title, post.excerpt, post.category].some((value) =>
        value.toLocaleLowerCase().includes(normalizedQuery),
      ),
    )
  }, [query])

  return (
    <div id="top" className="blog-page">
      <div className="ambient ambient--one" aria-hidden="true" />
      <div className="ambient ambient--two" aria-hidden="true" />

      <SiteHeader
        brand="Meika’s Blog"
        brandLabel="Meika’s Blog 首页"
        navigation={navigation}
      />

      <PageShell className="blog-main" contentClassName="blog-shell">
        <section className="blog-intro" aria-labelledby="blog-title">
          <div className="blog-heading-row">
            <div>
              <p className="eyebrow">WORLDLINE / WRITING</p>
              <h1 id="blog-title">博客</h1>
              <p className="blog-description">
                关于代码、设计和长期维护数字产品的笔记。
                <br />
                写下解决问题的过程，也记录那些暂时没有答案的问题。
              </p>
            </div>

            <a id="rss" className="rss-link" href="#rss" aria-label="订阅 RSS">
              <RssIcon />
              RSS
            </a>
          </div>

          <SearchBar value={query} onChange={setQuery} />

          <div className="article-count" aria-live="polite">
            <span>ARTICLES / INDEX</span>
            <span>
              {String(filteredPosts.length).padStart(2, '0')} /{' '}
              {String(posts.length).padStart(2, '0')}
            </span>
          </div>
        </section>

        <section id="articles" aria-label="文章列表">
          {filteredPosts.length > 0 ? (
            <div className="post-grid">
              {filteredPosts.map((post) => (
                <PostCard key={post.slug} post={post} />
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <span>[0]</span>
              <h2>没有找到匹配的文章</h2>
              <p>尝试缩短关键词，或者搜索其他主题。</p>
              <button type="button" onClick={() => setQuery('')}>
                清除搜索
              </button>
            </div>
          )}
        </section>

        <section id="notes" className="blog-note">
          <div>
            <p className="eyebrow">NOTES / 2026</p>
            <h2>不定期更新，保持长期可读。</h2>
          </div>
          <p>
            这里不会追逐更新频率。文章会在问题得到验证、想法变得清楚之后发布，
            并在需要时继续修订。
          </p>
        </section>

        <section id="projects" className="projects-strip" aria-label="项目状态">
          <span>[*] Worldline UI</span>
          <span>React + TypeScript</span>
          <span>STATUS: BUILDING</span>
        </section>

        <section id="about" className="about-section">
          <div>
            <p className="eyebrow">ABOUT</p>
            <h2>Worldline 是一个个人数字花园。</h2>
          </div>
          <div className="about-copy">
            <p>
              它用来保存技术实践、设计判断和日常观察。页面刻意保持简单，
              让内容可以在多年之后继续被阅读，而不依赖当下流行的视觉效果。
            </p>
            <a href="mailto:hello@example.com">hello@example.com ↗</a>
          </div>
        </section>

        <SiteFooter
          className="blog-footer"
          meta={
            <>
              <span>RSS / GitHub / Email</span>
              <span>© 2026</span>
            </>
          }
        />
      </PageShell>
    </div>
  )
}

export default App
