---
title: 中文博客一定要使用等宽字体吗？
description: 等宽字体带来秩序，也可能损害长文阅读。这里记录一套中西文混排的取舍方法。
published-at: 2026-06-29
featured-image: ./images/type.svg
featured-image-alt: 中文与英文字形的排版示意
featured-image-position: center
featured-image-zoom: 1.08
draft: true
---

等宽字体非常适合代码、日期和短标签，因为它能够创造明确的节奏。但中文正文天然接近方块结构，整页使用等宽字体可能让段落显得过于紧张。

我的做法是让界面标签、元信息和代码保持等宽，长篇正文则使用更适合阅读的中文字体。

```css
.metadata,
code {
  font-family: ui-monospace, monospace;
}

.article-body {
  font-family: system-ui, sans-serif;
}
```

字体选择最终应该服务阅读时间，而不是只服务截图效果。
