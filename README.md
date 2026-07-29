# GMJneko’s Blog

一个使用 React、TypeScript 和 Vite 构建的 Markdown 博客。

## 开发

```bash
npm install
npm run dev
```

生产构建：

```bash
npm run build
```

## 写文章

所有内容都位于 `content/posts`：

```text
content/posts/
└── engineering/
    ├── category.yml
    └── fix-a-bug-for-spring-ai/
        ├── post.md
        └── images/
```

分类目录名和文章目录名共同组成文章 URL：

```text
/posts/engineering/fix-a-bug-for-spring-ai
```

正文统一命名为 `post.md`，它不会出现在 URL 中。完整内容规范见 [doc/content.md](./doc/content.md)。

## 配置导航站

导航站入口位于 `/navigation`，分类和站点统一配置在 `content/navigation.yml`。站点名称、可选描述、可选图标和跳转网址的完整说明见 [doc/navigation.md](./doc/navigation.md)。

新增站点后可以自动下载并回填浏览器标签页图标：

```bash
npm run sync:navigation-icons
```

## 项目文档

- [内容系统](./doc/content.md)
- [导航站配置](./doc/navigation.md)
- [视觉设计系统](./doc/design.md)
- [组件库](./doc/components.md)
