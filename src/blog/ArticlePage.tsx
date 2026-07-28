import highlight from 'highlight.js/lib/core'
import bash from 'highlight.js/lib/languages/bash'
import css from 'highlight.js/lib/languages/css'
import go from 'highlight.js/lib/languages/go'
import java from 'highlight.js/lib/languages/java'
import javascript from 'highlight.js/lib/languages/javascript'
import json from 'highlight.js/lib/languages/json'
import kotlin from 'highlight.js/lib/languages/kotlin'
import markdown from 'highlight.js/lib/languages/markdown'
import python from 'highlight.js/lib/languages/python'
import rust from 'highlight.js/lib/languages/rust'
import typescript from 'highlight.js/lib/languages/typescript'
import xml from 'highlight.js/lib/languages/xml'
import yaml from 'highlight.js/lib/languages/yaml'
import { isValidElement, useState, type ReactNode } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { BlogPost } from './content'
import { resolvePostAsset } from './content'
import styles from './ArticlePage.module.css'

export interface ArticlePageProps {
  post: BlogPost
}

highlight.registerLanguage('bash', bash)
highlight.registerLanguage('css', css)
highlight.registerLanguage('go', go)
highlight.registerLanguage('java', java)
highlight.registerLanguage('javascript', javascript)
highlight.registerLanguage('json', json)
highlight.registerLanguage('kotlin', kotlin)
highlight.registerLanguage('markdown', markdown)
highlight.registerLanguage('python', python)
highlight.registerLanguage('rust', rust)
highlight.registerLanguage('typescript', typescript)
highlight.registerLanguage('xml', xml)
highlight.registerLanguage('yaml', yaml)

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
}: {
  children?: ReactNode
  className?: string
}) {
  const languageName = getLanguageName(className)
  if (!languageName) return <code className={className}>{children}</code>

  const language = languageAliases[languageName] ?? languageName
  if (!highlight.getLanguage(language)) {
    return <code className={className}>{children}</code>
  }

  const source = String(children).replace(/\n$/, '')
  const highlighted = highlight.highlight(source, { language }).value

  return (
    <code
      className={`hljs ${className}`}
      dangerouslySetInnerHTML={{ __html: highlighted }}
    />
  )
}

export function ArticlePage({ post }: ArticlePageProps) {
  return (
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
            code: CodeBlock,
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
  )
}
