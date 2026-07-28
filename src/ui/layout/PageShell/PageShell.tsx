import type { HTMLAttributes, ReactNode } from 'react'
import { cx } from '../../utils'
import styles from './PageShell.module.css'

export interface PageShellProps extends HTMLAttributes<HTMLElement> {
  children: ReactNode
  contentClassName?: string
}

export function PageShell({
  children,
  className,
  contentClassName,
  ...props
}: PageShellProps) {
  return (
    <main className={cx(styles.page, className)} {...props}>
      <div className={cx(styles.shell, contentClassName)}>{children}</div>
    </main>
  )
}
