import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { cx } from '../../utils'
import styles from './Wordmark.module.css'

export interface WordmarkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  children?: ReactNode
  logoSrc?: string
  logoAlt?: string
  size?: 'small' | 'medium'
}

export function Wordmark({
  children = 'worldline',
  className,
  logoSrc,
  logoAlt = '',
  size = 'medium',
  ...props
}: WordmarkProps) {
  return (
    <a className={cx(styles.wordmark, styles[size], className)} {...props}>
      {logoSrc ? (
        <img className={styles.logo} src={logoSrc} alt={logoAlt} />
      ) : null}
      {children}
    </a>
  )
}
