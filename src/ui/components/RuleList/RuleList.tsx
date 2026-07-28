import type { HTMLAttributes, ReactNode } from 'react'
import { cx } from '../../utils'
import styles from './RuleList.module.css'

export interface RuleListItem {
  description?: ReactNode
  marker?: ReactNode
  title: ReactNode
}

export interface RuleListProps extends HTMLAttributes<HTMLUListElement> {
  items: RuleListItem[]
}

export function RuleList({ className, items, ...props }: RuleListProps) {
  return (
    <ul className={cx(styles.list, className)} {...props}>
      {items.map((item, index) => (
        <li key={index}>
          <span className={styles.marker}>{item.marker ?? '[*]'}</span>
          <strong>{item.title}</strong>
          {item.description && <p>{item.description}</p>}
        </li>
      ))}
    </ul>
  )
}
