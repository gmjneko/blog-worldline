# Worldline UI 组件文档

本文档描述 `src/ui` 中每个公开组件的用途、主要属性和使用方式。

## 1. 快速开始

所有公开组件和类型均从统一入口导入：

```tsx
import {
  Badge,
  Button,
  PageShell,
  Section,
  SiteHeader,
} from './ui'
```

导入 `src/ui/index.ts` 时会自动载入组件库的设计令牌、基础样式和文章排版样式。

## 2. 通用约定

### 原生属性

大多数组件会继续接受对应 HTML 元素的原生属性。例如：

```tsx
<Section id="about" aria-labelledby="about-title" />
<Button type="submit" disabled>提交</Button>
<Wordmark href="/" target="_self">worldline</Wordmark>
```

### `className`

组件允许传入 `className` 扩展页面专属布局，但不建议使用它覆盖组件的核心视觉规则。

正确用途：

```tsx
<Button className="post-list-more" href="/archive">
  查看归档
</Button>
```

不建议：

```tsx
<Button className="make-it-purple-and-round">
  不一致的按钮
</Button>
```

### 内容与视觉职责

- 组件库负责结构、视觉状态、响应式和可访问性。
- 页面负责具体文案、数据和页面专属组合方式。
- 博客业务组件应在通用组件之上组合，不复制底层 CSS。

## 3. 组件总览

| 分类 | 组件 | 作用 |
| --- | --- | --- |
| 布局 | `PageShell` | 建立 1080px 页面外框 |
| 布局 | `SiteHeader` | 桌面与移动端站点导航 |
| 布局 | `Section` | 统一页面区块、标题和留白 |
| 布局 | `SiteFooter` | 站点页脚和元信息 |
| 基础 | `Wordmark` | 文字形式的站点标识 |
| 基础 | `Button` | 主、次和弱操作入口 |
| 基础 | `Badge` | 小型状态或分类标签 |
| 基础 | `Divider` | 内容分隔线 |
| 内容 | `RuleList` | 带终端标记的规则列表 |
| 内容 | `FigureGrid` | 单色数据图形网格 |
| 交互 | `Tabs` | 可控或非受控标签页 |
| 交互 | `CodePanel` | 单行代码展示与复制 |
| 交互 | `TerminalPanel` | 终端风格任务和状态展示 |

## 4. 布局组件

### `PageShell`

#### 作用

页面最外层容器。负责：

- 页面最大宽度。
- 桌面端左右边线。
- 窄屏边线移除。
- 页面底部留白。
- 页面统一背景。

一个完整页面通常只使用一个 `PageShell`。

#### 主要属性

```ts
interface PageShellProps extends HTMLAttributes<HTMLElement> {
  children: ReactNode
  contentClassName?: string
}
```

- `children`：页面内容。
- `className`：应用到外层 `<main>`。
- `contentClassName`：应用到内部 1080px 外框。
- 其他属性会传给 `<main>`。

#### 示例

```tsx
<PageShell id="top">
  <SiteHeader />
  <Section title="Hello">Content</Section>
  <SiteFooter />
</PageShell>
```

#### 使用建议

- 不要在 `PageShell` 外再创建另一套固定最大宽度。
- 弹窗、Portal 等脱离页面结构的内容可以位于其外部。

---

### `SiteHeader`

#### 作用

常驻在视口顶部的站点导航。导航使用半透明背景和模糊效果；桌面端显示导航链接和可选主操作，移动端自动切换为 `<details>` 菜单。

#### 相关类型

```ts
interface NavigationItem {
  active?: boolean
  href: string
  label: ReactNode
}

interface SiteHeaderProps {
  action?: NavigationItem
  brand?: ReactNode
  brandHref?: string
  brandLabel?: string
  navigation?: NavigationItem[]
}
```

#### 属性

- `brand`：品牌内容，默认为 `worldline`。
- `brandHref`：品牌链接，默认为 `#top`。
- `brandLabel`：品牌链接无障碍标签，默认为 `首页`。
- `navigation`：导航项目列表，项目可通过 `active` 标记当前页面。
- `action`：桌面端右侧主操作，同时会出现在移动菜单底部。

#### 示例

```tsx
<SiteHeader
  brand="worldline"
  brandHref="/"
  brandLabel="Worldline 首页"
  navigation={[
    { href: '/archive', label: 'Archive', active: true },
    { href: '/about', label: 'About' },
  ]}
  action={{ href: '/subscribe', label: '订阅' }}
/>
```

#### 行为

- 导航使用 `position: sticky` 常驻在视口顶部。
- 半透明背景配合 `backdrop-filter: blur(16px)`，页面滚动时保持内容可辨识。
- 当前页面链接通过 `aria-current="page"` 和底边线表达。
- `40rem` 以下隐藏桌面导航。
- 移动菜单使用原生 `<details>` 和 `<summary>`。
- 主操作使用 `Button` 的主按钮样式。

#### 使用建议

- 导航项目保持简短，建议不超过 5 个。
- `action` 应代表页面或站点最重要的单一操作。

---

### `Section`

#### 作用

统一页面区块的边线、留白、标题、说明、编号和操作区域。

#### 主要属性

```ts
interface SectionProps
  extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  actions?: ReactNode
  children?: ReactNode
  description?: ReactNode
  eyebrow?: ReactNode
  headingLevel?: 1 | 2 | 3 | 4
  index?: ReactNode
  title?: ReactNode
  variant?: 'default' | 'hero' | 'split'
}
```

#### 属性

- `title`：区块标题。
- `description`：标题下方说明，可以是字符串或自定义节点。
- `eyebrow`：标题上方内容，适合公告、标签和元信息。
- `headingLevel`：标题元素层级，默认为 `2`。
- `index`：右上角编号，例如 `FIG. 01—03`。
- `actions`：操作区域。
- `variant`：布局变体。
- `children`：区块主体内容。

#### 变体

##### `default`

普通内容区块，带顶部边线和标准留白。

```tsx
<Section title="最新文章" description="最近发布的内容">
  <PostList />
</Section>
```

##### `hero`

页面首屏区块。拥有更大留白和主标题字号，通常将 `headingLevel` 设置为 `1`。

```tsx
<Section
  variant="hero"
  headingLevel={1}
  title="记录思考，而不是制造噪音。"
  description="一个克制、清晰的数字空间。"
/>
```

##### `split`

桌面端将内容和操作横向排列，移动端自动变为纵向布局。

```tsx
<Section
  variant="split"
  title="订阅更新"
  description="新文章发布时收到通知。"
  actions={<Button href="/subscribe">订阅</Button>}
/>
```

#### 使用建议

- 页面主标题只能有一个 `h1`。
- `description` 需要特殊对齐时传入自定义节点并使用页面 CSS。
- 不要在 `Section` 内再手动复制相同区块留白。

---

### `SiteFooter`

#### 作用

显示站点标识和底部元信息。

#### 主要属性

```ts
interface SiteFooterProps extends HTMLAttributes<HTMLElement> {
  brand?: ReactNode
  brandHref?: string
  meta?: ReactNode
}
```

- `brand`：品牌内容。
- `brandHref`：品牌链接。
- `meta`：右侧或移动端下方的元信息。

#### 示例

```tsx
<SiteFooter
  meta={
    <>
      <span>Built with Worldline UI</span>
      <span>© 2026</span>
    </>
  }
/>
```

#### 使用建议

- `meta` 可以包含链接，但数量应保持克制。
- 不要在页脚重复整个主导航。

## 5. 基础组件

### `Wordmark`

#### 作用

以文字形式显示站点标识，避免页面分别实现不同的 Logo 字号和字距。

#### 主要属性

```ts
interface WordmarkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  children?: ReactNode
  size?: 'small' | 'medium'
}
```

- `children`：标识文字，默认 `worldline`。
- `size`：`medium` 用于页头，`small` 用于页脚。
- 其他属性传给 `<a>`。

#### 示例

```tsx
<Wordmark href="/" aria-label="返回首页">
  worldline
</Wordmark>
```

---

### `Button`

#### 作用

统一链接型操作和按钮型操作的视觉样式。

当传入 `href` 时渲染 `<a>`；未传入 `href` 时渲染 `<button>`。

#### 主要属性

```ts
type ButtonVariant = 'primary' | 'secondary' | 'ghost'

interface ButtonBaseProps {
  children: ReactNode
  className?: string
  icon?: ReactNode | false
  variant?: ButtonVariant
}
```

组件同时接受相应 `<a>` 或 `<button>` 的原生属性。

#### 变体

- `primary`：最重要的页面操作。
- `secondary`：次要操作或返回操作。
- `ghost`：接近普通链接的弱操作。

#### 图标规则

- `icon` 未传入时自动显示右箭头。
- `icon={false}` 不显示图标。
- `icon={<CustomIcon />}` 使用自定义图标。

#### 示例

```tsx
<Button href="/archive">查看归档</Button>

<Button variant="secondary" onClick={closeDialog}>
  关闭
</Button>

<Button variant="ghost" icon={false} href="/about">
  关于
</Button>
```

#### 使用建议

- 导航跳转使用带 `href` 的版本。
- 表单提交和本地状态操作使用按钮版本。
- 不要通过 `onClick` 模拟可以由链接完成的导航。

---

### `Badge`

#### 作用

显示小型状态、版本、分类或公告标签。

#### 主要属性

```ts
interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  children: ReactNode
  tone?: 'strong' | 'soft'
}
```

- `strong`：深色背景，用于显眼但短小的标签。
- `soft`：淡黄色背景，用于温和提示。

#### 示例

```tsx
<Badge>新</Badge>
<Badge tone="soft">Draft</Badge>
```

#### 使用建议

- 文本尽量控制在一个短词或极短短语。
- 不应将 Badge 用作可点击按钮。

---

### `Divider`

#### 作用

在不需要完整 `Section` 的局部内容中创建水平分隔线。

#### 主要属性

```ts
interface DividerProps extends HTMLAttributes<HTMLHRElement> {
  spacing?: 'none' | 'medium' | 'large'
}
```

- `none`：不添加上下间距。
- `medium`：上下 `32px`。
- `large`：上下 `64px`。

#### 示例

```tsx
<Divider spacing="medium" />
```

#### 使用建议

- 页面主区块优先使用 `Section` 自带的边线。
- `Divider` 适用于文章内部或组件内部的局部分组。

## 6. 内容组件

### `RuleList`

#### 作用

显示带有终端标记、标题和说明的规则列表。适合设计原则、功能说明、步骤概览和项目约束。

#### 相关类型

```ts
interface RuleListItem {
  description?: ReactNode
  marker?: ReactNode
  title: ReactNode
}

interface RuleListProps extends HTMLAttributes<HTMLUListElement> {
  items: RuleListItem[]
}
```

#### 示例

```tsx
<RuleList
  items={[
    {
      title: '隐私优先',
      description: '不在客户端之外存储不必要的数据。',
    },
    {
      marker: '[01]',
      title: '严格网格',
      description: '所有区块使用相同的页面边界。',
    },
  ]}
/>
```

#### 行为

- 默认标记为 `[*]`。
- 桌面端为标记、标题、说明三列。
- 移动端说明自动移动到标题下方。

---

### `FigureGrid`

#### 作用

显示三种单色抽象图形和图注，用于统计数据、设计参数或概念性指标。

#### 相关类型

```ts
type FigurePattern = 'lines' | 'dots' | 'bars'

interface FigureItem {
  label: ReactNode
  pattern: FigurePattern
  value: ReactNode
}

interface FigureGridProps extends HTMLAttributes<HTMLDivElement> {
  items: FigureItem[]
}
```

#### 示例

```tsx
<FigureGrid
  items={[
    { pattern: 'lines', value: '1080', label: '页面最大宽度' },
    { pattern: 'dots', value: '01', label: '主强调颜色' },
    { pattern: 'bars', value: '04', label: '基础间距单位' },
  ]}
/>
```

#### 行为

- 图注自动生成 `图 1.`、`图 2.` 等编号。
- 桌面端默认三列。
- 移动端自动变为单列。

#### 使用建议

- 目前图形是装饰性抽象表达，不适合替代需要精确读取的数据图表。
- 真实统计图应创建单独的可访问图表组件。

## 7. 交互组件

### `Tabs`

#### 作用

显示互斥内容面板，并提供完整的 ARIA 关系和键盘导航。

#### 相关类型

```ts
interface TabItem {
  id: string
  label: ReactNode
  content: ReactNode
}

interface TabsProps {
  ariaLabel: string
  className?: string
  defaultValue?: string
  items: TabItem[]
  onValueChange?: (value: string) => void
  value?: string
}
```

#### 非受控模式

组件内部维护选中状态：

```tsx
<Tabs
  ariaLabel="代码语言"
  defaultValue="tsx"
  items={[
    { id: 'tsx', label: 'tsx', content: <CodePanel code="..." /> },
    { id: 'css', label: 'css', content: <CodePanel code="..." /> },
  ]}
/>
```

#### 受控模式

页面维护选中状态：

```tsx
const [tab, setTab] = useState('latest')

<Tabs
  ariaLabel="文章筛选"
  value={tab}
  onValueChange={setTab}
  items={items}
/>
```

#### 键盘操作

- `ArrowRight`：选择下一个标签。
- `ArrowLeft`：选择上一个标签。
- `Home`：选择第一个标签。
- `End`：选择最后一个标签。

#### 使用建议

- `id` 在同一 Tabs 中必须唯一且稳定。
- `ariaLabel` 必须清楚说明这一组 Tabs 的用途。
- 不要用 Tabs 隐藏用户需要同时比较的内容。

---

### `CodePanel`

#### 作用

显示一行代码或命令，并提供复制状态反馈。

#### 主要属性

```ts
interface CodePanelProps extends HTMLAttributes<HTMLDivElement> {
  code: string
  copyable?: boolean
  embedded?: boolean
}
```

- `code`：显示和复制的文本。
- `copyable`：是否显示复制按钮，默认为 `true`。
- `embedded`：移除外层边框，用于嵌入 Tabs 等已经有容器的组件。

#### 示例

```tsx
<CodePanel code="npm run dev" />

<Tabs
  ariaLabel="安装方式"
  items={[
    {
      id: 'npm',
      label: 'npm',
      content: <CodePanel code="npm install" embedded />,
    },
  ]}
/>
```

#### 行为

- 点击复制按钮后显示短暂的“已复制”反馈。
- 窄屏下过长文本使用省略号。
- 移动端隐藏复制按钮旁的文字，只保留图标。

---

### `TerminalPanel`

#### 作用

展示终端风格的任务、状态和上下文信息。适合首页视觉区域、项目状态、构建过程或技术流程概览。

它是具有明确视觉目的的展示组件，不应代替真实终端或日志查看器。

#### 相关类型

```ts
interface TerminalTask {
  active?: boolean
  description?: ReactNode
  marker?: ReactNode
  title: ReactNode
}

interface TerminalContextGroup {
  label: ReactNode
  values: ReactNode[]
}

interface TerminalPanelProps
  extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  branch?: ReactNode
  context?: TerminalContextGroup[]
  prompt?: ReactNode
  status?: ReactNode
  subtitle?: ReactNode
  tasks?: TerminalTask[]
  title?: ReactNode
}
```

#### 示例

```tsx
<TerminalPanel
  aria-label="构建状态"
  title="worldline / build"
  branch="main"
  prompt="run production build"
  subtitle="Checking routes and content…"
  tasks={[
    {
      title: 'Compile',
      description: 'TypeScript and React',
    },
    {
      active: true,
      title: 'Render',
      description: 'Static pages',
    },
  ]}
  context={[
    {
      label: 'Build',
      values: ['24 pages', '0 errors'],
    },
  ]}
/>
```

#### 行为

- 普通任务默认标记为 `[*]`。
- 活动任务默认标记为 `■`，并显示左侧蓝色状态线。
- 桌面端上下文显示在右侧栏。
- 移动端隐藏右侧上下文栏，保留主要任务。
- 终端区域使用独立深色视觉，不随页面亮暗模式反转。

#### 使用建议

- `aria-label` 应描述终端面板的真实用途。
- 不要在一个页面重复使用多个大型 TerminalPanel。
- 大量真实日志应使用虚拟滚动或专门日志组件。

## 8. 样式工具

### `.wl-prose`

虽然它不是 React 组件，但它是组件库公开的文章排版基础类。

#### 作用

为 Markdown 或文章正文提供：

- 中文长文本行高。
- 标题颜色和字重。
- 链接样式。
- 行内代码和代码块样式。
- 引用块样式。
- 移动端字号调整。

#### 示例

```tsx
<article className="wl-prose">
  <h1>文章标题</h1>
  <p>正文内容。</p>
  <pre>
    <code>const value = 1</code>
  </pre>
</article>
```

正式博客开发时可以在 `.wl-prose` 基础上增加文章专属的表格、图片、脚注和标题锚点规则。

## 9. 组合示例

```tsx
import {
  Badge,
  Button,
  CodePanel,
  PageShell,
  RuleList,
  Section,
  SiteFooter,
  SiteHeader,
  Tabs,
} from './ui'

export function StyleExample() {
  return (
    <PageShell id="top">
      <SiteHeader
        navigation={[
          { href: '#intro', label: 'Intro' },
          { href: '#rules', label: 'Rules' },
        ]}
      />

      <Section
        id="intro"
        variant="hero"
        headingLevel={1}
        eyebrow={<Badge>新</Badge>}
        title="页面标题"
        description="一段简短而明确的页面说明。"
      >
        <Tabs
          ariaLabel="命令示例"
          items={[
            {
              id: 'npm',
              label: 'npm',
              content: <CodePanel code="npm run dev" embedded />,
            },
          ]}
        />
      </Section>

      <Section id="rules" title="设计规则">
        <RuleList
          items={[
            {
              title: '单色优先',
              description: '颜色只用于建立必要层级。',
            },
          ]}
        />
        <Button href="#top">返回顶部</Button>
      </Section>

      <SiteFooter meta={<span>© 2026</span>} />
    </PageShell>
  )
}
```

## 10. 新增组件规则

需要新增组件时，先确认：

1. 是否能由现有组件组合完成。
2. 是否会在两个或更多页面复用。
3. 是否拥有明确且稳定的视觉或交互职责。
4. 是否可以使用现有设计令牌。
5. 是否需要键盘、ARIA 或减少动态效果支持。

新增公开组件应：

- 放入 `src/ui/components` 或 `src/ui/layout`。
- 使用 CSS Modules。
- 使用 `--wl-*` 设计令牌。
- 导出 Props 类型。
- 从 `src/ui/index.ts` 统一导出。
- 在本文档中补充用途和示例。
- 在桌面端、移动端和暗色模式下验证。
