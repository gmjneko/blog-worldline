import {
  createElement,
  type HTMLAttributes,
  type ReactNode,
} from 'react'
import { cx } from '../../utils'
import styles from './Section.module.css'

export interface SectionProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  actions?: ReactNode
  children?: ReactNode
  description?: ReactNode
  eyebrow?: ReactNode
  headingLevel?: 1 | 2 | 3 | 4
  index?: ReactNode
  title?: ReactNode
  variant?: 'default' | 'hero' | 'split'
}

export function Section({
  actions,
  children,
  className,
  description,
  eyebrow,
  headingLevel = 2,
  index,
  title,
  variant = 'default',
  ...props
}: SectionProps) {
  const heading = title
    ? createElement(
        `h${headingLevel}`,
        { className: styles.title },
        title,
      )
    : null

  return (
    <section
      className={cx(styles.section, styles[variant], className)}
      {...props}
    >
      <div className={styles.content}>
        {(eyebrow || title || description || index) && (
          <header className={styles.heading}>
            <div>
              {eyebrow && <div className={styles.eyebrow}>{eyebrow}</div>}
              {heading}
              {description && (
                <div className={styles.description}>{description}</div>
              )}
            </div>
            {index && <span className={styles.index}>{index}</span>}
          </header>
        )}
        {children}
      </div>
      {actions && <div className={styles.actions}>{actions}</div>}
    </section>
  )
}
