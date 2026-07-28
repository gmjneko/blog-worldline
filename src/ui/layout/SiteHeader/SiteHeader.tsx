import type { ReactNode } from 'react'
import { Button } from '../../components/Button/Button'
import { Wordmark } from '../../components/Wordmark/Wordmark'
import styles from './SiteHeader.module.css'

export interface NavigationItem {
  href: string
  label: ReactNode
}

export interface SiteHeaderProps {
  action?: NavigationItem
  brand?: ReactNode
  brandHref?: string
  brandLabel?: string
  navigation?: NavigationItem[]
}

export function SiteHeader({
  action,
  brand = 'worldline',
  brandHref = '#top',
  brandLabel = '首页',
  navigation = [],
}: SiteHeaderProps) {
  return (
    <header className={styles.header}>
      <Wordmark href={brandHref} aria-label={brandLabel}>
        {brand}
      </Wordmark>

      <nav className={styles.desktopNav} aria-label="主导航">
        {navigation.map((item) => (
          <a className={styles.navigationLink} key={item.href} href={item.href}>
            {item.label}
          </a>
        ))}
        {action && (
          <Button href={action.href} icon={<span aria-hidden="true">↓</span>}>
            {action.label}
          </Button>
        )}
      </nav>

      <details className={styles.mobileMenu}>
        <summary aria-label="打开菜单">
          <span />
          <span />
        </summary>
        <nav aria-label="移动端导航">
          {navigation.map((item) => (
            <a key={item.href} href={item.href}>
              {item.label}
            </a>
          ))}
        </nav>
      </details>
    </header>
  )
}
