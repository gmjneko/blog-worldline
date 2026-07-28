import type { ChangeEvent, FormEvent } from 'react'
import styles from './SearchBar.module.css'

export interface SearchBarProps {
  onChange: (value: string) => void
  onSubmit?: () => void
  value: string
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <circle cx="7" cy="7" r="4.25" />
      <path d="m10.25 10.25 3 3" />
    </svg>
  )
}

export function SearchBar({ onChange, onSubmit, value }: SearchBarProps) {
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange(event.target.value)
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    onSubmit?.()
  }

  return (
    <form className={styles.form} role="search" onSubmit={handleSubmit}>
      <label className={styles.inputWrap}>
        <span className={styles.srOnly}>搜索文章</span>
        <SearchIcon />
        <input
          type="search"
          value={value}
          onChange={handleChange}
          placeholder="搜索标题、摘要或分类"
        />
      </label>
      <button type="submit">搜索</button>
    </form>
  )
}
