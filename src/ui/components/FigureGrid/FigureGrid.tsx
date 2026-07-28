import type { HTMLAttributes, ReactNode } from 'react'
import { cx } from '../../utils'
import styles from './FigureGrid.module.css'

export type FigurePattern = 'lines' | 'dots' | 'bars'

export interface FigureItem {
  label: ReactNode
  pattern: FigurePattern
  value: ReactNode
}

export interface FigureGridProps extends HTMLAttributes<HTMLDivElement> {
  items: FigureItem[]
}

export function FigureGrid({ className, items, ...props }: FigureGridProps) {
  return (
    <div className={cx(styles.grid, className)} {...props}>
      {items.map((item, index) => (
        <figure key={index}>
          <div
            className={cx(styles.plot, styles[item.pattern])}
            aria-hidden="true"
          />
          <figcaption>
            <span>图 {index + 1}.</span>
            <strong>{item.value}</strong>
            {item.label}
          </figcaption>
        </figure>
      ))}
    </div>
  )
}
