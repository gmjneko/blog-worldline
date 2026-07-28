import type { HTMLAttributes, ReactNode } from 'react'
import { cx } from '../../utils'
import styles from './Badge.module.css'

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  children: ReactNode
  tone?: 'strong' | 'soft'
}

export function Badge({
  children,
  className,
  tone = 'strong',
  ...props
}: BadgeProps) {
  return (
    <span className={cx(styles.badge, styles[tone], className)} {...props}>
      {children}
    </span>
  )
}
