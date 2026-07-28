import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { cx } from '../../utils'
import styles from './Wordmark.module.css'

export interface WordmarkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  children?: ReactNode
  size?: 'small' | 'medium'
}

export function Wordmark({
  children = 'worldline',
  className,
  size = 'medium',
  ...props
}: WordmarkProps) {
  return (
    <a className={cx(styles.wordmark, styles[size], className)} {...props}>
      {children}
    </a>
  )
}
