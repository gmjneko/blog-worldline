import {
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react'
import { cx } from '../../utils'
import styles from './Tabs.module.css'

export interface TabItem {
  id: string
  label: ReactNode
  content: ReactNode
}

export interface TabsProps {
  ariaLabel: string
  className?: string
  defaultValue?: string
  items: TabItem[]
  onValueChange?: (value: string) => void
  value?: string
}

export function Tabs({
  ariaLabel,
  className,
  defaultValue,
  items,
  onValueChange,
  value,
}: TabsProps) {
  const baseId = useId()
  const [internalValue, setInternalValue] = useState(
    defaultValue ?? items[0]?.id ?? '',
  )
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([])
  const activeValue = value ?? internalValue
  const activeItem = items.find((item) => item.id === activeValue) ?? items[0]

  const select = (nextValue: string) => {
    if (value === undefined) setInternalValue(nextValue)
    onValueChange?.(nextValue)
  }

  const handleKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
      return
    }

    event.preventDefault()
    let nextIndex = index

    if (event.key === 'ArrowRight') nextIndex = (index + 1) % items.length
    if (event.key === 'ArrowLeft') {
      nextIndex = (index - 1 + items.length) % items.length
    }
    if (event.key === 'Home') nextIndex = 0
    if (event.key === 'End') nextIndex = items.length - 1

    const nextItem = items[nextIndex]
    if (!nextItem) return
    select(nextItem.id)
    buttonRefs.current[nextIndex]?.focus()
  }

  if (!activeItem) return null

  return (
    <div className={cx(styles.tabs, className)}>
      <div className={styles.tabList} role="tablist" aria-label={ariaLabel}>
        {items.map((item, index) => {
          const selected = item.id === activeItem.id
          const tabId = `${baseId}-${item.id}-tab`
          const panelId = `${baseId}-${item.id}-panel`

          return (
            <button
              key={item.id}
              ref={(node) => {
                buttonRefs.current[index] = node
              }}
              id={tabId}
              type="button"
              role="tab"
              aria-controls={panelId}
              aria-selected={selected}
              tabIndex={selected ? 0 : -1}
              onClick={() => select(item.id)}
              onKeyDown={(event) => handleKeyDown(event, index)}
            >
              {item.label}
            </button>
          )
        })}
      </div>
      <div
        id={`${baseId}-${activeItem.id}-panel`}
        role="tabpanel"
        aria-labelledby={`${baseId}-${activeItem.id}-tab`}
      >
        {activeItem.content}
      </div>
    </div>
  )
}
