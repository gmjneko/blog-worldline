import type { HTMLAttributes, ReactNode } from 'react'
import { Wordmark } from '../../components/Wordmark/Wordmark'
import { cx } from '../../utils'
import styles from './SiteFooter.module.css'

export interface SiteFooterProps extends HTMLAttributes<HTMLElement> {
  brand?: ReactNode
  brandHref?: string
  meta?: ReactNode
}

export function SiteFooter({
  brand = 'worldline',
  brandHref = '#top',
  className,
  meta,
  ...props
}: SiteFooterProps) {
  return (
    <footer className={cx(styles.footer, className)} {...props}>
      <Wordmark href={brandHref} size="small">
        {brand}
      </Wordmark>
      {meta && <div className={styles.meta}>{meta}</div>}
    </footer>
  )
}
