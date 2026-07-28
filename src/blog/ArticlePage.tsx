import {
  isValidElement,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { BlogPost } from './content'
import { resolvePostAsset } from './content'
import styles from './ArticlePage.module.css'

export interface ArticlePageProps {
  post: BlogPost
}

const languageAliases: Record<string, string> = {
  html: 'xml',
  golang: 'go',
  js: 'javascript',
  jsx: 'javascript',
  md: 'markdown',
  py: 'python',
  rs: 'rust',
  sh: 'bash',
  shell: 'bash',
  ts: 'typescript',
  tsx: 'typescript',
  yml: 'yaml',
}

const languageLabels: Record<string, string> = {
  bash: 'shell',
  css: 'css',
  go: 'go',
  java: 'java',
  javascript: 'javascript',
  json: 'json',
  kotlin: 'kotlin',
  markdown: 'markdown',
  python: 'python',
  rust: 'rust',
  typescript: 'typescript',
  xml: 'html',
  yaml: 'yaml',
}

function getLanguageName(className?: string) {
  return className?.match(/language-([\w-]+)/)?.[1]
}

function textContent(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(textContent).join('')
  if (isValidElement<{ children?: ReactNode }>(node)) {
    return textContent(node.props.children)
  }
  return ''
}

interface TableOfContentsItem {
  id: string
  level: 2 | 3
  text: string
}

function headingTextFromMarkdown(value: string) {
  return value
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/[`*_~]/g, '')
    .trim()
}

function createHeadingId(value: string) {
  return (
    value
      .trim()
      .toLocaleLowerCase()
      .replace(/[^\p{Letter}\p{Number}\s-]/gu, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') || 'section'
  )
}

function extractTableOfContents(markdown: string): TableOfContentsItem[] {
  const items: TableOfContentsItem[] = []
  let inCodeFence = false

  for (const line of markdown.split('\n')) {
    if (/^\s*(?:```|~~~)/.test(line)) {
      inCodeFence = !inCodeFence
      continue
    }

    if (inCodeFence) continue

    const match = /^(#{2,3})\s+(.+?)\s*#*\s*$/.exec(line)
    if (!match) continue

    const text = headingTextFromMarkdown(match[2])
    if (!text) continue

    items.push({
      id: createHeadingId(text),
      level: match[1].length as 2 | 3,
      text,
    })
  }

  return items
}

function readHashHeading() {
  if (!window.location.hash) return undefined

  try {
    return decodeURIComponent(window.location.hash.slice(1))
  } catch {
    return window.location.hash.slice(1)
  }
}

function CodeFrame({ children }: { children?: ReactNode }) {
  const [copied, setCopied] = useState(false)
  const className = isValidElement<{ className?: string }>(children)
    ? children.props.className
    : undefined
  const languageName = getLanguageName(className)
  const language = languageName
    ? languageAliases[languageName] ?? languageName
    : undefined
  const label = language
    ? languageLabels[language] ?? language.toUpperCase()
    : undefined
  const source = isValidElement<{ children?: ReactNode }>(children)
    ? textContent(children.props.children).replace(/\n$/, '')
    : ''

  const handleCopy = async () => {
    await navigator.clipboard.writeText(source)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div
      className={`${styles.codeFrame} ${label ? '' : styles.codeFramePlain}`}
    >
      {label && (
        <div className={styles.codeHeader}>
          <span>{label}</span>
        </div>
      )}
      <pre>{children}</pre>
      <button
        className={styles.copyButton}
        type="button"
        aria-label={copied ? '已复制代码' : '复制代码'}
        title={copied ? '已复制' : '复制代码'}
        onClick={handleCopy}
      >
        {copied ? (
          <span aria-hidden="true">✓</span>
        ) : (
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <rect x="5.5" y="5.5" width="7" height="7" />
            <path d="M3.5 10.5h-1v-7h7v1" />
          </svg>
        )}
      </button>
    </div>
  )
}

function CodeBlock({
  children,
  className,
  highlightedHtml,
}: {
  children?: ReactNode
  className?: string
  highlightedHtml?: string
}) {
  const languageName = getLanguageName(className)
  if (!languageName || !highlightedHtml) {
    return <code className={className}>{children}</code>
  }

  return (
    <code
      className={`shiki ${className}`}
      dangerouslySetInnerHTML={{ __html: highlightedHtml }}
    />
  )
}

export function ArticlePage({ post }: ArticlePageProps) {
  const tableOfContents = useMemo(
    () => extractTableOfContents(post.content),
    [post.content],
  )
  const [activeHeading, setActiveHeading] = useState(
    () => readHashHeading() ?? tableOfContents[0]?.id,
  )

  useEffect(() => {
    const headingIds = new Set(tableOfContents.map((item) => item.id))
    const headings = tableOfContents
      .map((item) => document.getElementById(item.id))
      .filter((heading): heading is HTMLElement => Boolean(heading))

    const observer = new IntersectionObserver(
      (entries) => {
        const visibleHeading = entries
          .filter((entry) => entry.isIntersecting)
          .sort(
            (left, right) =>
              left.boundingClientRect.top - right.boundingClientRect.top,
          )[0]

        if (visibleHeading) setActiveHeading(visibleHeading.target.id)
      },
      { rootMargin: '-96px 0px -68% 0px' },
    )

    headings.forEach((heading) => observer.observe(heading))

    const handleHashChange = () => {
      const heading = readHashHeading()
      if (heading && headingIds.has(heading)) setActiveHeading(heading)
    }

    window.addEventListener('hashchange', handleHashChange)
    window.addEventListener('popstate', handleHashChange)
    return () => {
      observer.disconnect()
      window.removeEventListener('hashchange', handleHashChange)
      window.removeEventListener('popstate', handleHashChange)
    }
  }, [tableOfContents])

  return (
    <div
      className={`${styles.layout} ${
        tableOfContents.length === 0 ? styles.layoutWithoutToc : ''
      }`}
    >
      <article className={styles.article}>
        <a className={styles.backLink} href="/">
          <span aria-hidden="true">←</span>
          返回全部文章
        </a>

        <header className={styles.header}>
          <p className={styles.eyebrow}>{post.categoryName} / POST</p>
          <h1>{post.title}</h1>
          <p className={styles.description}>{post.description}</p>
          <div className={styles.meta}>
            <time dateTime={post.date}>{post.date}</time>
            <span>{post.readingTime}</span>
            <span>{post.categoryName}</span>
          </div>
        </header>

        {post.featuredImage && (
          <figure className={styles.featuredImage}>
            <img
              src={post.featuredImage.src}
              alt={post.featuredImage.alt}
              style={{
                objectPosition: post.featuredImage.position,
                transform: `scale(${post.featuredImage.zoom})`,
              }}
            />
          </figure>
        )}

        <div className={`wl-prose ${styles.prose}`}>
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              code: ({ children, className, node }) => (
                <CodeBlock
                  className={className}
                  highlightedHtml={
                    node?.position?.start.line
                      ? post.codeHighlights[node.position.start.line]
                      : undefined
                  }
                >
                  {children}
                </CodeBlock>
              ),
              h2: ({ children }) => (
                <h2 id={createHeadingId(textContent(children))}>{children}</h2>
              ),
              h3: ({ children }) => (
                <h3 id={createHeadingId(textContent(children))}>{children}</h3>
              ),
              img: ({ alt, src, title }) => (
                <img
                  src={resolvePostAsset(post, src)}
                  alt={alt ?? ''}
                  title={title}
                  loading="lazy"
                />
              ),
              pre: CodeFrame,
            }}
          >
            {post.content}
          </ReactMarkdown>
        </div>

        <footer className={styles.footer}>
          <span>END / {post.slug.toUpperCase()}</span>
          <a href="/">继续阅读其他文章 →</a>
        </footer>
      </article>

      {tableOfContents.length > 0 && (
        <aside className={styles.toc} aria-label="文章目录">
          <div className={styles.tocPanel}>
            <p className={styles.tocTitle}>目录</p>
            <nav aria-label="本文目录">
              <ol className={styles.tocList}>
                {tableOfContents.map((item) => (
                  <li key={`${item.level}-${item.id}`}>
                    <a
                      className={`${styles.tocLink} ${
                        item.level === 3 ? styles.tocLinkNested : ''
                      } ${
                        activeHeading === item.id ? styles.tocLinkActive : ''
                      }`}
                      href={`#${item.id}`}
                      aria-current={
                        activeHeading === item.id ? 'location' : undefined
                      }
                      onClick={(event) => {
                        event.preventDefault()
                        window.history.pushState(null, '', `#${item.id}`)
                        document.getElementById(item.id)?.scrollIntoView({
                          behavior: window.matchMedia(
                            '(prefers-reduced-motion: reduce)',
                          ).matches
                            ? 'auto'
                            : 'smooth',
                          block: 'start',
                        })
                        setActiveHeading(item.id)
                      }}
                    >
                      {item.text}
                    </a>
                  </li>
                ))}
              </ol>
            </nav>
          </div>
        </aside>
      )}
    </div>
  )
}
