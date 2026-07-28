import type { BlogPost } from './posts'
import styles from './PostCard.module.css'

export interface PostCardProps {
  post: BlogPost
}

export function PostCard({ post }: PostCardProps) {
  return (
    <a className={styles.card} href={`#${post.slug}`}>
      <article id={post.slug} className={styles.article}>
        {post.cover && (
          <div className={`${styles.cover} ${styles[post.cover]}`} aria-hidden="true">
            <span>{post.category.slice(0, 2).toUpperCase()}</span>
          </div>
        )}

        <div className={styles.content}>
          <div className={styles.meta}>
            {post.pinned && <strong>置顶</strong>}
            <time dateTime={post.date}>{post.date}</time>
            <span>{post.category}</span>
            <span>{post.readingTime}</span>
          </div>

          <h2>{post.title}</h2>
          <p>{post.excerpt}</p>

          <span className={styles.readMore}>
            READ NOTE
            <span aria-hidden="true">↗</span>
          </span>
        </div>
      </article>
    </a>
  )
}
