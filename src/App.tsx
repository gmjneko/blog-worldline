import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ArticlePage,
  CategoryFilter,
  PostCard,
  SearchBar,
  categories,
  findPost,
  posts,
} from './blog'
import { PageShell, SiteFooter, SiteHeader } from './ui'
import './App.css'

interface BrowserLocation {
  pathname: string
  search: string
}

function readBrowserLocation(): BrowserLocation {
  return {
    pathname: window.location.pathname,
    search: window.location.search,
  }
}

function useBrowserLocation() {
  const [location, setLocation] = useState(readBrowserLocation)

  useEffect(() => {
    const handlePopState = () => setLocation(readBrowserLocation())
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  const navigate = useCallback((url: string) => {
    window.history.pushState(null, '', url)
    setLocation(readBrowserLocation())
  }, [])

  return { location, navigate }
}

function getPostRoute(pathname: string) {
  const segments = pathname.split('/').filter(Boolean)
  if (segments.length !== 3 || segments[0] !== 'posts') return undefined
  return { categorySlug: segments[1], postSlug: segments[2] }
}

function usePageMetadata(title: string, description: string) {
  useEffect(() => {
    document.title = title
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute('content', description)
  }, [description, title])
}

const navigation = [
  { href: '/', label: '博客', active: true },
  { href: '/#categories', label: '分类' },
  { href: '/#posts', label: '文章' },
  { href: '/#search', label: '搜索' },
]

function BlogLayout({ children }: { children: React.ReactNode }) {
  return (
    <div id="top" className="blog-page">
      <div className="ambient ambient--one" aria-hidden="true" />
      <div className="ambient ambient--two" aria-hidden="true" />

      <SiteHeader
        brand="Meika’s Blog"
        brandHref="/"
        brandLabel="Meika’s Blog 首页"
        navigation={navigation}
      />

      {children}
    </div>
  )
}

function BlogIndex({
  location,
  navigate,
}: {
  location: BrowserLocation
  navigate: (url: string) => void
}) {
  const categoryFromUrl = new URLSearchParams(location.search).get('category')
  const selectedCategory = categories.some(
    (category) => category.slug === categoryFromUrl,
  )
    ? (categoryFromUrl as string)
    : 'all'
  const [query, setQuery] = useState('')

  usePageMetadata(
    'Meika’s Blog — Posts',
    '关于代码、设计和长期维护数字产品的文章。',
  )

  const categoryPosts = useMemo(
    () =>
      selectedCategory === 'all'
        ? posts
        : posts.filter((post) => post.categorySlug === selectedCategory),
    [selectedCategory],
  )

  const filteredPosts = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase()
    if (!normalizedQuery) return categoryPosts

    return categoryPosts.filter((post) =>
      [post.title, post.description, post.categoryName].some((value) =>
        value.toLocaleLowerCase().includes(normalizedQuery),
      ),
    )
  }, [categoryPosts, query])

  const activeCategory = categories.find(
    (category) => category.slug === selectedCategory,
  )

  const handleCategorySelect = (slug: string) => {
    const nextUrl = new URL(window.location.href)
    if (slug === 'all') nextUrl.searchParams.delete('category')
    else nextUrl.searchParams.set('category', slug)
    nextUrl.hash = 'posts'
    navigate(`${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`)
  }

  return (
    <BlogLayout>
      <PageShell className="blog-main" contentClassName="blog-shell">
        <section className="blog-intro" aria-labelledby="blog-title">
          <p className="eyebrow">MEIKA’S BLOG / WRITING</p>
          <h1 id="blog-title">POSTS</h1>
          <p className="blog-description">
            关于代码、设计和长期维护数字产品的文章。
            <br />
            分类来自内容目录，默认显示全部文章。
          </p>

          <CategoryFilter
            categories={categories}
            current={selectedCategory}
            onSelect={handleCategorySelect}
          />

          {activeCategory && (
            <p className="active-category-description">
              <strong>{activeCategory.name}</strong>
              {activeCategory.description}
            </p>
          )}

          <div id="search" className="blog-search">
            <SearchBar value={query} onChange={setQuery} />
          </div>

          <div className="article-count" aria-live="polite">
            <span>POSTS / INDEX</span>
            <span>
              {String(filteredPosts.length).padStart(2, '0')} /{' '}
              {String(categoryPosts.length).padStart(2, '0')}
            </span>
          </div>
        </section>

        <section id="posts" aria-label="文章列表">
          {filteredPosts.length > 0 ? (
            <div className="post-grid">
              {filteredPosts.map((post) => (
                <PostCard key={post.url} post={post} />
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <span>[0]</span>
              <h2>没有找到匹配的文章</h2>
              <p>尝试缩短关键词，或者切换到其他分类。</p>
              <button type="button" onClick={() => setQuery('')}>
                清除搜索
              </button>
            </div>
          )}
        </section>

        <SiteFooter
          className="blog-footer"
          brand="Meika’s Blog"
          brandHref="/"
          meta={
            <>
              <span>MARKDOWN / STATIC CONTENT</span>
              <span>© 2026</span>
            </>
          }
        />
      </PageShell>
    </BlogLayout>
  )
}

function PostDetail({ categorySlug, postSlug }: { categorySlug: string; postSlug: string }) {
  const post = findPost(categorySlug, postSlug)
  usePageMetadata(
    post ? `${post.title} — Meika’s Blog` : '文章不存在 — Meika’s Blog',
    post?.description ?? '没有找到对应的文章。',
  )

  if (!post) return <NotFound />

  return (
    <BlogLayout>
      <PageShell className="blog-main" contentClassName="blog-shell article-shell">
        <ArticlePage post={post} />
      </PageShell>
    </BlogLayout>
  )
}

function NotFound() {
  return (
    <BlogLayout>
      <PageShell className="blog-main" contentClassName="blog-shell">
        <main className="not-found">
          <p className="eyebrow">404 / NOT FOUND</p>
          <h1>这里没有这篇文章。</h1>
          <p>文章可能已经移动，或者当前地址并不存在。</p>
          <a href="/">返回全部文章 →</a>
        </main>
      </PageShell>
    </BlogLayout>
  )
}

function App() {
  const { location, navigate } = useBrowserLocation()
  const postRoute = getPostRoute(location.pathname)

  if (postRoute) {
    return <PostDetail {...postRoute} />
  }

  if (location.pathname !== '/') {
    return <NotFound />
  }

  return <BlogIndex location={location} navigate={navigate} />
}

export default App
