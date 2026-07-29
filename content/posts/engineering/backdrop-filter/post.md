---
title: backdrop-filter 的边界与性能
description: 模糊效果并不只是一行 CSS，层叠上下文、透明度和滚动性能都值得仔细处理。
published-at: 2026-07-12
featured-image: ./images/blur.svg
featured-image-alt: 半透明窗口覆盖在文字之上的效果示意
featured-image-position: center
featured-image-zoom: 1.12
draft: true
---

`backdrop-filter` 很适合常驻导航栏，因为它可以在保留页面上下文的同时维持文字可读性。

```css
.site-header {
  background: rgb(253 252 252 / 82%);
  backdrop-filter: blur(16px) saturate(150%);
}
```

## 不要忽略背景透明度

只有模糊而没有半透明背景时，复杂内容仍然可能穿透导航文字。反过来，如果背景接近完全不透明，模糊又失去了意义。

移动设备上还需要观察滚动性能。模糊区域应该尽量小，并避免在整个页面上叠加多个持续变化的滤镜。
