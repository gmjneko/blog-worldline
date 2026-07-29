# 导航站配置

导航站的全部分类和站点都由项目根目录的 `content/navigation.yml` 管理，修改 YAML 后不需要再改 React 组件。

## 配置结构

```yaml
categories:
  - name: AI 工具
    description: 对话、检索与辅助创作工具。
    sites:
      - name: ChatGPT
        description: OpenAI 的通用 AI 助手。
        icon: ''
        url: https://chatgpt.com/
```

分类按照 YAML 中的顺序显示，每个分类包含一个 `sites` 数组。

站点字段：

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `name` | 是 | 站点名称 |
| `description` | 否 | 站点简介；留空或省略时不显示 |
| `icon` | 否 | 图标网址，或 `public` 目录中的绝对路径；留空时页面使用站名首字符 |
| `url` | 是 | 点击卡片后打开的 HTTP/HTTPS 地址 |

分类的 `description` 也可以留空。所有图标都会放入同样大小的容器，并以 `24 × 24` 等比缩放。

## 同步网站图标

新增站点并保持 `icon` 为空后，运行：

```bash
npm run sync:navigation-icons
```

脚本会：

1. 跳过已经配置 `icon` 的站点。
2. 请求站点首页，解析浏览器标签页使用的 `<link rel="icon">` 等声明。
3. 下载图标到 `public/navigation-icons/`。
4. 把 `/navigation-icons/...` 本地路径自动写回 `content/navigation.yml`。
5. 在控制台集中列出所有未能自动下载图标的站点。

下载后的文件名直接使用站点 `name`，空格会替换为连字符，例如 `DeepSeek.svg`、`MDN-Web-Docs.svg`。文件名不会附加哈希；同一配置中不能存在会生成相同文件名的站点名称。

如果需要更新某个站点的图标，直接删除 `public/navigation-icons/` 中对应的文件，再重新运行命令。脚本发现 YAML 中的本地图标文件不存在时，会自动重新下载并更新路径。

只有自动下载失败并且仍未手动配置 `icon` 的站点，页面才会显示站点名称首字符作为自动生成的占位图标。页面本身不会再临时请求目标站点的 `/favicon.ico`。

配置格式错误、缺少名称或网址、网址协议不正确时，开发页面会直接给出包含字段路径的错误信息。
