import type { HTMLAttributes } from 'react'
import { cx } from '../../utils'
import styles from './Divider.module.css'

export interface DividerProps extends HTMLAttributes<HTMLHRElement> {
  spacing?: 'none' | 'medium' | 'large'
}

export function Divider({
  className,
  spacing = 'none',
  ...props
}: DividerProps) {
  return (
    <hr
      className={cx(styles.divider, styles[spacing], className)}
      {...props}
    />
  )
}
