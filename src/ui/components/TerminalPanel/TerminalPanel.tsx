import type { HTMLAttributes, ReactNode } from 'react'
import { cx } from '../../utils'
import styles from './TerminalPanel.module.css'

export interface TerminalTask {
  active?: boolean
  description?: ReactNode
  marker?: ReactNode
  title: ReactNode
}

export interface TerminalContextGroup {
  label: ReactNode
  values: ReactNode[]
}

export interface TerminalPanelProps
  extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  branch?: ReactNode
  context?: TerminalContextGroup[]
  prompt?: ReactNode
  status?: ReactNode
  subtitle?: ReactNode
  tasks?: TerminalTask[]
  title?: ReactNode
}

export function TerminalPanel({
  branch = 'main',
  className,
  context = [],
  prompt,
  status = '● ready',
  subtitle,
  tasks = [],
  title = 'terminal',
  ...props
}: TerminalPanelProps) {
  return (
    <section
      className={cx(styles.section, className)}
      aria-label="终端界面"
      {...props}
    >
      <div className={styles.window}>
        <div className={styles.bar}>
          <span>{title}</span>
          <span>{branch}</span>
        </div>
        <div className={styles.body}>
          <div className={styles.main}>
            {prompt && (
              <p className={styles.prompt}>
                <span>›</span> {prompt}
              </p>
            )}
            {subtitle && <p className={styles.muted}>{subtitle}</p>}
            {tasks.map((task, index) => (
              <div
                key={index}
                className={cx(styles.task, task.active && styles.activeTask)}
              >
                <span>{task.marker ?? (task.active ? '■' : '[*]')}</span>
                <p>
                  <strong>{task.title}</strong>
                  {task.description && <small>{task.description}</small>}
                </p>
              </div>
            ))}
          </div>
          {context.length > 0 && (
            <aside className={styles.aside}>
              {context.map((group, index) => (
                <div key={index} className={styles.contextGroup}>
                  <p>{group.label}</p>
                  {group.values.map((value, valueIndex) => (
                    <span key={valueIndex}>{value}</span>
                  ))}
                </div>
              ))}
            </aside>
          )}
        </div>
        <div className={styles.status}>
          <span>{status}</span>
          <span>esc cancel&nbsp;&nbsp; tab switch</span>
        </div>
      </div>
    </section>
  )
}
