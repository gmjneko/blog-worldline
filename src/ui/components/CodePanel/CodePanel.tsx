import { useState, type HTMLAttributes } from 'react'
import { CopyIcon } from '../../icons'
import { cx } from '../../utils'
import styles from './CodePanel.module.css'

export interface CodePanelProps extends HTMLAttributes<HTMLDivElement> {
  code: string
  copyable?: boolean
  embedded?: boolean
}

export function CodePanel({
  className,
  code,
  copyable = true,
  embedded = false,
  ...props
}: CodePanelProps) {
  const [copied, setCopied] = useState(false)

  const copyCode = async () => {
    await navigator.clipboard?.writeText(code)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1400)
  }

  return (
    <div
      className={cx(styles.panel, embedded && styles.embedded, className)}
      {...props}
    >
      <code>{code}</code>
      {copyable && (
        <button type="button" onClick={copyCode} aria-label="复制代码">
          <CopyIcon />
          <span>{copied ? '已复制' : '复制'}</span>
        </button>
      )}
    </div>
  )
}
