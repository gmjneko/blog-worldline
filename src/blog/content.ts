import {
  categories as generatedCategories,
  posts as generatedPosts,
} from 'virtual:blog-content'

export interface BlogCategory {
  description: string
  name: string
  order: number
  slug: string
}

export interface FeaturedImage {
  alt: string
  position: string
  src: string
  zoom: number
}

export interface BlogPost {
  assets: Record<string, string>
  categoryName: string
  categorySlug: string
  content: string
  date: string
  description: string
  featuredImage?: FeaturedImage
  pinned: boolean
  readingTime: string
  slug: string
  title: string
  url: string
}

export const categories = generatedCategories as BlogCategory[]
export const posts = generatedPosts as BlogPost[]

export function findPost(categorySlug: string, postSlug: string) {
  return posts.find(
    (post) => post.categorySlug === categorySlug && post.slug === postSlug,
  )
}

export function resolvePostAsset(post: BlogPost, source?: string) {
  if (!source || /^(?:[a-z]+:|\/|#)/i.test(source)) return source
  const normalizedSource = source.startsWith('./') ? source : `./${source}`
  return post.assets[normalizedSource] ?? source
}
