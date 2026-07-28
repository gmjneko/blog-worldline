import type { BlogPost } from './content'
import styles from './PostCard.module.css'

export interface PostCardProps {
  post: BlogPost
}

export function PostCard({ post }: PostCardProps) {
  return (
    <a className={styles.card} href={post.url}>
      <article className={styles.article}>
        {post.featuredImage && (
          <div className={styles.cover}>
            <img
              src={post.featuredImage.src}
              alt=""
              style={{
                objectPosition: post.featuredImage.position,
                transform: `scale(${post.featuredImage.zoom})`,
              }}
            />
          </div>
        )}

        <div className={styles.content}>
          <div className={styles.meta}>
            {post.pinned && <strong>置顶</strong>}
            <time dateTime={post.date}>{post.date}</time>
            <span>{post.categoryName}</span>
            <span>{post.readingTime}</span>
          </div>

          <h2>{post.title}</h2>
          <p>{post.description}</p>

          <span className={styles.readMore}>
            READ POST
            <span aria-hidden="true">↗</span>
          </span>
        </div>
      </article>
    </a>
  )
}
