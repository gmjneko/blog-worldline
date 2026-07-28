export type PostCover = 'grid' | 'signal' | 'type' | 'window' | 'stack'

export interface BlogPost {
  category: string
  cover?: PostCover
  date: string
  excerpt: string
  pinned?: boolean
  readingTime: string
  slug: string
  title: string
}

export const posts: BlogPost[] = [
  {
    slug: 'quiet-interface',
    title: '如何构建一个不会打扰阅读的界面',
    excerpt:
      '从颜色、边界、间距和排版出发，重新理解一个内容网站真正需要的视觉层级。',
    date: '2026-07-28',
    category: '设计',
    readingTime: '8 min',
    pinned: true,
    cover: 'grid',
  },
  {
    slug: 'component-system',
    title: '从单页原型到可复用组件系统',
    excerpt:
      '记录 Worldline UI 的拆分过程：哪些规则应该进入组件，哪些应该继续留在页面里。',
    date: '2026-07-24',
    category: '工程',
    readingTime: '12 min',
    cover: 'stack',
  },
  {
    slug: 'white-hierarchy',
    title: '白色界面里，信息层级从哪里来？',
    excerpt:
      '当页面不再依赖彩色卡片和阴影，字重、留白与一条细线就需要承担更多职责。',
    date: '2026-07-19',
    category: '设计',
    readingTime: '6 min',
    cover: 'signal',
  },
  {
    slug: 'backdrop-filter',
    title: 'backdrop-filter 的边界与性能',
    excerpt:
      '模糊效果并不只是加上一行 CSS：层叠上下文、透明度和滚动性能都值得仔细处理。',
    date: '2026-07-12',
    category: 'CSS',
    readingTime: '9 min',
    cover: 'window',
  },
  {
    slug: 'vite-personal-site',
    title: '用 Vite 与 React 搭建个人知识空间',
    excerpt:
      '从最小项目开始，逐步加入内容模型、路由、构建流程以及可以长期维护的目录结构。',
    date: '2026-07-06',
    category: '前端',
    readingTime: '15 min',
  },
  {
    slug: 'mono-for-chinese',
    title: '中文博客一定要使用等宽字体吗？',
    excerpt:
      '等宽字体带来秩序，也可能损害长文阅读。这里记录一套中西文混排的取舍方法。',
    date: '2026-06-29',
    category: '排版',
    readingTime: '7 min',
    cover: 'type',
  },
  {
    slug: 'design-tokens',
    title: '设计令牌不是另一份颜色表',
    excerpt:
      '真正有用的令牌描述的是界面语义，它们需要同时服务组件、页面与未来的主题变化。',
    date: '2026-06-20',
    category: '设计系统',
    readingTime: '10 min',
  },
  {
    slug: 'small-blog-search',
    title: '小型博客需要怎样的搜索体验',
    excerpt:
      '没有复杂后端时，前端过滤仍然可以做到快速、清楚，并且保持键盘与屏幕阅读器友好。',
    date: '2026-06-14',
    category: '产品',
    readingTime: '5 min',
  },
  {
    slug: 'writing-rhythm',
    title: '建立一种可持续的写作节奏',
    excerpt:
      '比起追求更新频率，更重要的是建立收集、整理、写作和修订之间的稳定循环。',
    date: '2026-06-02',
    category: '随记',
    readingTime: '4 min',
    cover: 'signal',
  },
  {
    slug: 'personal-web',
    title: '个人网站仍然值得被认真设计',
    excerpt:
      '在平台和信息流之外，自己的站点依然是组织知识、表达观点和保存时间的好地方。',
    date: '2026-05-25',
    category: '互联网',
    readingTime: '8 min',
  },
]
