import type { MouseEvent } from 'react'
import type { BlogCategory } from './content'
import styles from './CategoryFilter.module.css'

export interface CategoryFilterProps {
  categories: BlogCategory[]
  current: string
  onSelect: (slug: string) => void
}

function categoryHref(slug: string) {
  return slug === 'all' ? '/#posts' : `/?category=${encodeURIComponent(slug)}#posts`
}

export function CategoryFilter({
  categories,
  current,
  onSelect,
}: CategoryFilterProps) {
  const options = [{ name: '全部', slug: 'all' }, ...categories]

  const handleClick = (event: MouseEvent<HTMLAnchorElement>, slug: string) => {
    event.preventDefault()
    onSelect(slug)
  }

  return (
    <nav id="categories" className={styles.filter} aria-label="文章分类">
      <span className={styles.label}>FILTER</span>
      <div className={styles.options}>
        {options.map((category) => (
          <a
            key={category.slug}
            href={categoryHref(category.slug)}
            aria-current={current === category.slug ? 'page' : undefined}
            onClick={(event) => handleClick(event, category.slug)}
          >
            {category.name}
          </a>
        ))}
      </div>
    </nav>
  )
}
