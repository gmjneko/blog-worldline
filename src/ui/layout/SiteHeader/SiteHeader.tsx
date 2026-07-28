import type { ReactNode } from 'react'
import { Button } from '../../components/Button/Button'
import { Wordmark } from '../../components/Wordmark/Wordmark'
import styles from './SiteHeader.module.css'

export interface NavigationItem {
  active?: boolean
  disabled?: boolean
  href: string
  label: ReactNode
  external?: boolean
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
          {navigation.map((item) =>
            item.disabled ? (
              <span
                className={`${styles.navigationLink} ${styles.navigationLinkDisabled}`}
                key={item.href}
                aria-disabled="true"
                title="暂未开放"
              >
                {item.label}
              </span>
            ) : (
              <a
                className={styles.navigationLink}
                key={item.href}
                href={item.href}
                aria-current={item.active ? 'page' : undefined}
                target={item.external ? '_blank' : undefined}
                rel={item.external ? 'noreferrer' : undefined}
              >
                {item.label}
              </a>
            ),
          )}
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
            {navigation.map((item) =>
              item.disabled ? (
                <span
                  className={styles.mobileDisabled}
                  key={item.href}
                  aria-disabled="true"
                >
                  {item.label}
                  <small>COMING SOON</small>
                </span>
              ) : (
                <a
                  key={item.href}
                  href={item.href}
                  aria-current={item.active ? 'page' : undefined}
                  target={item.external ? '_blank' : undefined}
                  rel={item.external ? 'noreferrer' : undefined}
                >
                  {item.label}
                </a>
              ),
            )}
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
