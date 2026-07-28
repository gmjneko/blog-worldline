# Meika’s Blog 内容系统

本文档定义博客分类、文章目录、Markdown Front Matter、图片资源、URL 和构建校验规则。

## 1. 内容目录

博客内容与界面源码分离，全部放在项目根目录的 `content/posts` 中。

```text
content/
└── posts/
    ├── design/
    │   ├── category.yml
    │   └── quiet-interface/
    │       ├── post.md
    │       └── images/
    │           └── cover.svg
    └── engineering/
        ├── category.yml
        └── fix-a-bug-for-spring-ai/
            ├── post.md
            └── images/
                └── debug-flow.svg
```

目录层级固定为：

```text
content/posts/{分类 slug}/{文章 slug}/post.md
```

分类和文章目录名必须使用小写字母、数字和连字符，例如：

```text
spring-ai
fix-a-bug-for-spring-ai
```

不建议在公开 URL 中使用空格、中文目录名或下划线。

## 2. 分类配置

每个分类目录必须包含一个 `category.yml`：

```yaml
name: 工程
description: 软件开发、前端架构与问题排查笔记。
order: 20
```

字段说明：

| 字段 | 必填 | 作用 |
| --- | --- | --- |
| `name` | 是 | 显示在分类选项中的名称 |
| `description` | 是 | 选择分类后显示的介绍 |
| `order` | 否 | 分类排序，默认值为 `0` |

分类 slug 直接使用目录名，不需要在配置文件中重复填写。

## 3. 文章目录

分类目录下的每个子目录代表一篇文章。

文章目录必须满足：

- 有且仅有一个 Markdown 文件。
- Markdown 文件必须命名为 `post.md`。
- 图片等资源可以放在任意子目录中，推荐统一使用 `images/`。
- 文章 URL 使用文章目录名，不使用 Markdown 文件名。

例如：

```text
content/posts/engineering/fix-a-bug-for-spring-ai/post.md
```

对应 URL：

```text
/posts/engineering/fix-a-bug-for-spring-ai
```

## 4. Front Matter

每篇文章必须在文件第一行开始书写 YAML Front Matter：

```markdown
---
title: 修复一个 Spring AI 集成中的问题
description: 从错误日志、最小复现到依赖边界，记录一次问题定位过程。
published-at: 2026-07-28
featured-image: ./images/cover.png
featured-image-alt: 问题排查流程示意
featured-image-position: center
featured-image-zoom: 1
pinned: false
draft: false
---

这里是 Markdown 正文。
```

字段说明：

| 字段 | 必填 | 默认值 | 作用 |
| --- | --- | --- | --- |
| `title` | 是 | — | 文章标题 |
| `description` | 是 | — | 列表摘要和页面描述 |
| `published-at` | 是 | — | 发布日期，格式必须是 `YYYY-MM-DD` |
| `featured-image` | 否 | — | 缩略图相对路径，必须以 `./` 开头 |
| `featured-image-alt` | 否 | 空字符串 | 缩略图替代文字 |
| `featured-image-position` | 否 | `center` | 图片裁切焦点，对应 `object-position` |
| `featured-image-zoom` | 否 | `1` | 图片放大比例，允许 `1` 到 `2` |
| `pinned` | 否 | `false` | 是否置顶 |
| `draft` | 否 | `false` | 是否为草稿 |

开发环境会展示草稿，生产构建会自动排除 `draft: true` 的文章。

## 5. 图片

Front Matter 和 Markdown 正文中的图片都使用相对于 `post.md` 的路径：

```markdown
![问题排查流程](./images/debug-flow.svg)
```

文章卡片的缩略图使用固定尺寸并应用：

```css
object-fit: cover;
object-position: center;
```

因此不同宽高的图片会自动裁切成一致的展示比例。主体不在中央时可以调整：

```yaml
featured-image-position: 50% 30%
featured-image-zoom: 1.15
```

## 6. 代码高亮

代码块顶部会显示语言名称，并根据 Markdown 围栏声明的语言自动高亮。书写代码时应标记语言：

````markdown
```css
.site-header {
  backdrop-filter: blur(16px);
}
```
````

未声明语言的代码块仍会正常显示，但不会显示顶部语言栏，也不会进行特定语言的词法高亮。

当前按需加载的语言包括 CSS、HTML、JavaScript、TypeScript、Java、Kotlin、Shell、JSON、YAML、Markdown、Python、Rust 和 Go。常用别名 `py`、`rs`、`golang`、`js`、`ts`、`jsx`、`tsx`、`sh` 和 `yml` 也可以直接使用。

## 7. 分类筛选

博客页面会自动读取全部 `category.yml`，生成“全部”和各分类选项。

- 默认显示全部文章。
- 分类状态保存在查询参数中。
- 示例：`/?category=engineering`。
- 搜索只在当前分类中进行。
- 分类选项和文章数量不需要在 React 源码中手动维护。

## 8. 排序与阅读时间

- 置顶文章优先显示。
- 其余文章按照 `published-at` 从新到旧排列。
- 阅读时间根据 Markdown 正文中的中英文字符自动估算。

## 9. 构建校验

内容扫描在 Vite 构建阶段执行。以下情况会让开发服务器或生产构建直接报错：

- 缺少 `category.yml`。
- 分类配置不是合法 YAML。
- 分类缺少名称或描述。
- 分类或文章目录名不符合 slug 规则。
- 文章目录不存在 Markdown，或存在多个 Markdown。
- 正文没有命名为 `post.md`。
- Front Matter 缺少标题、描述或发布日期。
- 日期不是 `YYYY-MM-DD`。
- 缩略图路径不存在。
- 图片缩放比例不在 `1` 到 `2` 之间。
- Markdown 正文为空。

修改内容后运行：

```bash
npm run build
```

## 10. 部署要求

文章详情使用客户端路由。部署平台需要把不存在的静态路径回退到 `index.html`，否则直接打开文章 URL 时会返回服务器 404。

常见静态托管平台通常把这个功能称为 SPA fallback、rewrite 或 history fallback。
