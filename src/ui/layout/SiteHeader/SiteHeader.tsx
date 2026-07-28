import type { ReactNode } from 'react'
import { Button } from '../../components/Button/Button'
import { Wordmark } from '../../components/Wordmark/Wordmark'
import styles from './SiteHeader.module.css'

export interface NavigationItem {
  active?: boolean
  href: string
  label: ReactNode
}

export interface SiteHeaderProps {
  action?: NavigationItem
  brand?: ReactNode
  brandHref?: string
  brandLabel?: string
  brandLogoSrc?: string
  navigation?: NavigationItem[]
}

export function SiteHeader({
  action,
  brand = 'worldline',
  brandHref = '#top',
  brandLabel = '首页',
  brandLogoSrc,
  navigation = [],
}: SiteHeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Wordmark href={brandHref} aria-label={brandLabel} logoSrc={brandLogoSrc}>
          {brand}
        </Wordmark>

        <nav className={styles.desktopNav} aria-label="主导航">
          {navigation.map((item) => (
            <a
              className={styles.navigationLink}
              key={item.href}
              href={item.href}
              aria-current={item.active ? 'page' : undefined}
            >
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
              <a
                key={item.href}
                href={item.href}
                aria-current={item.active ? 'page' : undefined}
              >
                {item.label}
              </a>
            ))}
            {action && (
              <a className={styles.mobileAction} href={action.href}>
                {action.label}
                <span aria-hidden="true">↓</span>
              </a>
            )}
          </nav>
        </details>
      </div>
    </header>
  )
}
