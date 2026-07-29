import { createHash } from 'node:crypto'
import { mkdir, readdir, readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import sharp, { type Metadata } from 'sharp'
import type { Plugin } from 'vite'
import { normalizePath } from 'vite'
import { createHighlighter, type BundledLanguage } from 'shiki'
import { parse as parseYaml } from 'yaml'

const virtualModuleId = 'virtual:blog-content'
const resolvedVirtualModuleId = `\0${virtualModuleId}`
const automaticPreviewExtensions = new Set(['.avif', '.jpeg', '.jpg', '.png', '.webp'])
const automaticPreviewHeight = 306
const automaticPreviewMaxInputHeight = 900
const automaticPreviewMaxInputPixels = 1_000_000
const automaticPreviewMaxInputWidth = 1200
const automaticPreviewVersion = 'v3'
const automaticPreviewWidth = 408
const imageExtensions = new Set([
  '.avif',
  '.gif',
  '.jpeg',
  '.jpg',
  '.png',
  '.svg',
  '.webp',
])
const shikiTheme = 'vitesse-light'
const shikiLanguages = [
  'bash',
  'css',
  'go',
  'html',
  'java',
  'javascript',
  'json',
  'jsx',
  'kotlin',
  'markdown',
  'python',
  'rust',
  'tsx',
  'typescript',
  'xml',
  'yaml',
] satisfies BundledLanguage[]
const shikiLanguageAliases: Record<string, BundledLanguage> = {
  bash: 'bash',
  css: 'css',
  go: 'go',
  golang: 'go',
  html: 'html',
  java: 'java',
  javascript: 'javascript',
  js: 'javascript',
  json: 'json',
  jsx: 'jsx',
  kotlin: 'kotlin',
  markdown: 'markdown',
  md: 'markdown',
  python: 'python',
  py: 'python',
  rs: 'rust',
  rust: 'rust',
  sh: 'bash',
  shell: 'bash',
  ts: 'typescript',
  tsx: 'tsx',
  typescript: 'typescript',
  xml: 'xml',
  yaml: 'yaml',
  yml: 'yaml',
}

let codeHighlighter: ReturnType<typeof createHighlighter> | undefined

interface BlogContentPluginOptions {
  includeDrafts?: boolean
  root: string
}

interface CategoryRecord {
  description: string
  name: string
  order: number
  slug: string
}

interface FeaturedImageRecord {
  alt: string
  assetPath: string
  position: string
  previewAssetPath?: string
  zoom: number
}

interface PostRecord {
  assets: Map<string, string>
  categoryName: string
  categorySlug: string
  codeHighlights: Map<number, string>
  content: string
  date: string
  description: string
  draft: boolean
  featuredImage?: FeaturedImageRecord
  pinned: boolean
  readingTime: string
  slug: string
  title: string
  url: string
}

interface ParsedFrontMatter {
  attributes: Record<string, unknown>
  body: string
}

interface MarkdownCodeFence {
  language: string
  source: string
  startLine: number
}

function fail(filePath: string, message: string): never {
  throw new Error(`[blog-content] ${normalizePath(filePath)}: ${message}`)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function requiredString(
  attributes: Record<string, unknown>,
  key: string,
  filePath: string,
) {
  const value = attributes[key]
  if (typeof value !== 'string' || value.trim() === '') {
    fail(filePath, `Front Matter 字段 “${key}” 必须是非空字符串。`)
  }

  return value.trim()
}

function optionalString(
  attributes: Record<string, unknown>,
  key: string,
  filePath: string,
) {
  const value = attributes[key]
  if (value === undefined) return undefined
  if (typeof value !== 'string' || value.trim() === '') {
    fail(filePath, `Front Matter 字段 “${key}” 必须是非空字符串。`)
  }

  return value.trim()
}

function parseFrontMatter(source: string, filePath: string): ParsedFrontMatter {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)
  if (!match) {
    fail(filePath, '文件必须以 YAML Front Matter 开头。')
  }

  const parsed = parseYaml(match[1])
  if (!isRecord(parsed)) {
    fail(filePath, 'Front Matter 必须是一个 YAML 对象。')
  }

  return {
    attributes: parsed,
    body: source.slice(match[0].length).trim(),
  }
}

function validateSlug(slug: string, filePath: string, kind: string) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    fail(filePath, `${kind}目录名必须使用小写字母、数字和连字符。`)
  }
}

function calculateReadingTime(content: string) {
  const withoutCode = content.replace(/```[\s\S]*?```/g, ' ')
  const latinWords = withoutCode.match(/[A-Za-z0-9]+(?:[-'][A-Za-z0-9]+)*/g)?.length ?? 0
  const cjkCharacters = withoutCode.match(/[\u3400-\u9fff]/g)?.length ?? 0
  return `${Math.max(1, Math.ceil((latinWords + cjkCharacters) / 260))} min`
}

function getCodeHighlighter() {
  codeHighlighter ??= createHighlighter({
    langs: shikiLanguages,
    themes: [shikiTheme],
  })
  return codeHighlighter
}

function extractCodeFences(markdown: string): MarkdownCodeFence[] {
  const codeFences: MarkdownCodeFence[] = []
  const lines = markdown.split('\n')
  let currentFence:
    | {
        language: string
        marker: string
        sourceLines: string[]
        startLine: number
      }
    | undefined

  for (const [index, line] of lines.entries()) {
    if (!currentFence) {
      const openingFence = /^(?: {0,3})(`{3,}|~{3,})([^\r\n]*)$/.exec(line)
      if (!openingFence) continue

      const language = openingFence[2].trim().split(/\s+/, 1)[0]?.toLowerCase()
      if (!language) continue

      currentFence = {
        language,
        marker: openingFence[1],
        sourceLines: [],
        startLine: index + 1,
      }
      continue
    }

    const markerCharacter = currentFence.marker[0]
    const closingFence = new RegExp(
      `^ {0,3}${markerCharacter}{${currentFence.marker.length},}\\s*$`,
    )
    if (closingFence.test(line)) {
      codeFences.push({
        language: currentFence.language,
        source: currentFence.sourceLines.join('\n'),
        startLine: currentFence.startLine,
      })
      currentFence = undefined
      continue
    }

    currentFence.sourceLines.push(line)
  }

  return codeFences
}

function codeInnerHtml(highlightedHtml: string) {
  const codeStart = highlightedHtml.indexOf('<code>')
  const codeEnd = highlightedHtml.lastIndexOf('</code>')
  if (codeStart === -1 || codeEnd === -1) return undefined
  return highlightedHtml.slice(codeStart + '<code>'.length, codeEnd)
}

async function highlightCodeFences(markdown: string, filePath: string) {
  const codeFences = extractCodeFences(markdown)
  const highlights = new Map<number, string>()
  if (codeFences.length === 0) return highlights

  const highlighter = await getCodeHighlighter()
  for (const codeFence of codeFences) {
    const language = shikiLanguageAliases[codeFence.language]
    if (!language) continue

    try {
      const highlightedHtml = highlighter.codeToHtml(codeFence.source, {
        lang: language,
        theme: shikiTheme,
      })
      const innerHtml = codeInnerHtml(highlightedHtml)
      if (innerHtml) highlights.set(codeFence.startLine, innerHtml)
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error)
      fail(filePath, `Shiki 无法高亮 ${codeFence.language} 代码块：${reason}`)
    }
  }

  return highlights
}

async function listDirectories(directory: string) {
  const entries = await readdir(directory, { withFileTypes: true })
  return entries
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
    .map((entry) => entry.name)
    .sort()
}

async function listImages(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true })
  const images: string[] = []

  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue
    const entryPath = path.join(directory, entry.name)

    if (entry.isDirectory()) {
      images.push(...(await listImages(entryPath)))
      continue
    }

    if (entry.isFile() && imageExtensions.has(path.extname(entry.name).toLowerCase())) {
      images.push(entryPath)
    }
  }

  return images.sort()
}

function parseObjectPosition(position: string) {
  let x: number | undefined
  let y: number | undefined

  for (const token of position.trim().toLowerCase().split(/\s+/)) {
    if (token === 'left') {
      x = 0
    } else if (token === 'right') {
      x = 1
    } else if (token === 'top') {
      y = 0
    } else if (token === 'bottom') {
      y = 1
    } else if (token === 'center') {
      if (x === undefined) x = 0.5
      else if (y === undefined) y = 0.5
    } else if (/^-?\d+(?:\.\d+)?%$/.test(token)) {
      const percentage = Math.min(1, Math.max(0, Number.parseFloat(token) / 100))
      if (x === undefined) x = percentage
      else if (y === undefined) y = percentage
    }
  }

  return { x: x ?? 0.5, y: y ?? 0.5 }
}

function calculatePreviewCrop(width: number, height: number, position: string) {
  const targetAspectRatio = automaticPreviewWidth / automaticPreviewHeight
  const sourceAspectRatio = width / height
  const focus = parseObjectPosition(position)

  if (sourceAspectRatio > targetAspectRatio) {
    const cropWidth = Math.min(width, Math.round(height * targetAspectRatio))
    return {
      height,
      left: Math.round((width - cropWidth) * focus.x),
      top: 0,
      width: cropWidth,
    }
  }

  const cropHeight = Math.min(height, Math.round(width / targetAspectRatio))
  return {
    height: cropHeight,
    left: 0,
    top: Math.round((height - cropHeight) * focus.y),
    width,
  }
}

async function createAutomaticPreview(
  imagePath: string,
  cacheDirectory: string,
  position: string,
) {
  const extension = path.extname(imagePath).toLowerCase()
  if (!automaticPreviewExtensions.has(extension)) return undefined

  const source = await readFile(imagePath)
  let metadata: Metadata

  try {
    metadata = await sharp(source).metadata()
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    fail(imagePath, `无法读取主图尺寸：${reason}`)
  }

  const width = metadata.autoOrient?.width ?? metadata.width
  const height = metadata.autoOrient?.height ?? metadata.height
  if (!width || !height) return undefined

  const needsPreview =
    width > automaticPreviewMaxInputWidth ||
    height > automaticPreviewMaxInputHeight ||
    width * height > automaticPreviewMaxInputPixels
  if (!needsPreview) return undefined

  const hash = createHash('sha256')
    .update(automaticPreviewVersion)
    .update(position)
    .update(source)
    .digest('hex')
    .slice(0, 20)
  const previewPath = path.join(cacheDirectory, `${hash}.jpg`)

  try {
    if ((await stat(previewPath)).isFile()) return previewPath
  } catch {
    // 缓存未命中时继续生成。
  }

  await mkdir(cacheDirectory, { recursive: true })

  try {
    const crop = calculatePreviewCrop(width, height, position)
    await sharp(source)
      .rotate()
      .extract(crop)
      .resize({
        fit: 'fill',
        height: automaticPreviewHeight,
        kernel: sharp.kernel.lanczos3,
        width: automaticPreviewWidth,
      })
      .flatten({ background: '#fff' })
      .jpeg({ chromaSubsampling: '4:4:4', mozjpeg: true, quality: 92 })
      .toFile(previewPath)
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    fail(imagePath, `无法生成卡片预览图：${reason}`)
  }

  return previewPath
}

async function readCategory(categoryDirectory: string, slug: string) {
  const configPath = path.join(categoryDirectory, 'category.yml')
  let source: string

  try {
    source = await readFile(configPath, 'utf8')
  } catch {
    fail(categoryDirectory, '分类目录必须包含 category.yml。')
  }

  const parsed = parseYaml(source)
  if (!isRecord(parsed)) {
    fail(configPath, 'category.yml 必须是一个 YAML 对象。')
  }

  const name = requiredString(parsed, 'name', configPath)
  const description = requiredString(parsed, 'description', configPath)
  const orderValue = parsed.order ?? 0
  if (typeof orderValue !== 'number' || !Number.isFinite(orderValue)) {
    fail(configPath, '字段 “order” 必须是数字。')
  }

  return {
    category: { description, name, order: orderValue, slug },
    configPath,
  }
}

async function readPost(
  articleDirectory: string,
  category: CategoryRecord,
  previewCacheDirectory: string,
): Promise<{ post: PostRecord; watchedFiles: string[] }> {
  const entries = await readdir(articleDirectory, { withFileTypes: true })
  const markdownFiles = entries.filter(
    (entry) => entry.isFile() && path.extname(entry.name).toLowerCase() === '.md',
  )

  if (markdownFiles.length !== 1) {
    fail(articleDirectory, '每篇文章的目录中必须有且仅有一个 Markdown 文件。')
  }

  if (markdownFiles[0].name !== 'post.md') {
    fail(articleDirectory, '文章正文必须命名为 post.md；URL 使用文章目录名生成。')
  }

  const slug = path.basename(articleDirectory)
  validateSlug(slug, articleDirectory, '文章')

  const markdownPath = path.join(articleDirectory, markdownFiles[0].name)
  const source = await readFile(markdownPath, 'utf8')
  const { attributes, body } = parseFrontMatter(source, markdownPath)
  const title = requiredString(attributes, 'title', markdownPath)
  const description = requiredString(attributes, 'description', markdownPath)
  const date = requiredString(attributes, 'published-at', markdownPath)

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) {
    fail(markdownPath, '字段 “published-at” 必须使用 YYYY-MM-DD 格式。')
  }

  if (body === '') {
    fail(markdownPath, 'Markdown 正文不能为空。')
  }

  const draftValue = attributes.draft ?? false
  const pinnedValue = attributes.pinned ?? false
  if (typeof draftValue !== 'boolean') {
    fail(markdownPath, '字段 “draft” 必须是布尔值。')
  }
  if (typeof pinnedValue !== 'boolean') {
    fail(markdownPath, '字段 “pinned” 必须是布尔值。')
  }

  const imagePaths = await listImages(articleDirectory)
  const assets = new Map<string, string>()
  for (const imagePath of imagePaths) {
    const relativePath = `./${normalizePath(path.relative(articleDirectory, imagePath))}`
    assets.set(relativePath, imagePath)
  }

  const featuredImagePath = optionalString(attributes, 'featured-image', markdownPath)
  const featuredImagePreviewPath = optionalString(
    attributes,
    'featured-image-preview',
    markdownPath,
  )
  if (featuredImagePreviewPath && !featuredImagePath) {
    fail(markdownPath, '字段 “featured-image-preview” 必须和 “featured-image” 一起使用。')
  }

  let featuredImage: FeaturedImageRecord | undefined
  if (featuredImagePath) {
    if (!featuredImagePath.startsWith('./')) {
      fail(markdownPath, '字段 “featured-image” 必须使用以 ./ 开头的文章内相对路径。')
    }

    const normalizedFeaturedImagePath = `./${normalizePath(
      featuredImagePath.replace(/^\.\//, ''),
    )}`
    const assetPath = assets.get(normalizedFeaturedImagePath)
    if (!assetPath) {
      fail(markdownPath, `找不到缩略图 “${featuredImagePath}”。`)
    }

    const position = optionalString(attributes, 'featured-image-position', markdownPath) ?? 'center'
    let previewAssetPath: string | undefined
    if (featuredImagePreviewPath) {
      if (!featuredImagePreviewPath.startsWith('./')) {
        fail(
          markdownPath,
          '字段 “featured-image-preview” 必须使用以 ./ 开头的文章内相对路径。',
        )
      }

      const normalizedPreviewImagePath = `./${normalizePath(
        featuredImagePreviewPath.replace(/^\.\//, ''),
      )}`
      previewAssetPath = assets.get(normalizedPreviewImagePath)
      if (!previewAssetPath) {
        fail(markdownPath, `找不到预览缩略图 “${featuredImagePreviewPath}”。`)
      }
    } else {
      previewAssetPath = await createAutomaticPreview(
        assetPath,
        previewCacheDirectory,
        position,
      )
    }

    const zoomValue = attributes['featured-image-zoom'] ?? 1
    if (
      typeof zoomValue !== 'number' ||
      !Number.isFinite(zoomValue) ||
      zoomValue < 1 ||
      zoomValue > 2
    ) {
      fail(markdownPath, '字段 “featured-image-zoom” 必须是 1 到 2 之间的数字。')
    }

    featuredImage = {
      alt: optionalString(attributes, 'featured-image-alt', markdownPath) ?? '',
      assetPath,
      position,
      previewAssetPath,
      zoom: zoomValue,
    }
  }

  return {
    post: {
      assets,
      categoryName: category.name,
      categorySlug: category.slug,
      codeHighlights: await highlightCodeFences(body, markdownPath),
      content: body,
      date,
      description,
      draft: draftValue,
      featuredImage,
      pinned: pinnedValue,
      readingTime: calculateReadingTime(body),
      slug,
      title,
      url: `/posts/${category.slug}/${slug}`,
    },
    watchedFiles: [markdownPath, ...imagePaths],
  }
}

async function createVirtualModule(
  contentRoot: string,
  includeDrafts: boolean,
  previewCacheDirectory: string,
): Promise<{ code: string; watchedFiles: string[] }> {
  try {
    if (!(await stat(contentRoot)).isDirectory()) {
      fail(contentRoot, '内容路径必须是目录。')
    }
  } catch {
    fail(contentRoot, '找不到 content/posts 内容目录。')
  }

  const categorySlugs = await listDirectories(contentRoot)
  const categories: CategoryRecord[] = []
  const posts: PostRecord[] = []
  const watchedFiles: string[] = []

  for (const categorySlug of categorySlugs) {
    const categoryDirectory = path.join(contentRoot, categorySlug)
    validateSlug(categorySlug, categoryDirectory, '分类')
    const { category, configPath } = await readCategory(categoryDirectory, categorySlug)
    categories.push(category)
    watchedFiles.push(configPath)

    const articleSlugs = await listDirectories(categoryDirectory)
    for (const articleSlug of articleSlugs) {
      const { post, watchedFiles: postFiles } = await readPost(
        path.join(categoryDirectory, articleSlug),
        category,
        previewCacheDirectory,
      )
      watchedFiles.push(...postFiles)
      if (includeDrafts || !post.draft) posts.push(post)
    }
  }

  categories.sort((first, second) => first.order - second.order || first.name.localeCompare(second.name))
  posts.sort((first, second) => {
    if (first.pinned !== second.pinned) return first.pinned ? -1 : 1
    return second.date.localeCompare(first.date)
  })

  const assetVariables = new Map<string, string>()
  for (const post of posts) {
    for (const assetPath of post.assets.values()) {
      if (!assetVariables.has(assetPath)) {
        assetVariables.set(assetPath, `__blogAsset${assetVariables.size}`)
      }
    }

    const previewAssetPath = post.featuredImage?.previewAssetPath
    if (previewAssetPath && !assetVariables.has(previewAssetPath)) {
      assetVariables.set(previewAssetPath, `__blogAsset${assetVariables.size}`)
    }
  }

  const imports = [...assetVariables].map(
    ([assetPath, variable]) =>
      `import ${variable} from ${JSON.stringify(`${normalizePath(assetPath)}?url`)}`,
  )

  const postSource = posts.map((post) => {
    const featuredImage = post.featuredImage
      ? `{ alt: ${JSON.stringify(post.featuredImage.alt)}, position: ${JSON.stringify(post.featuredImage.position)}, previewSrc: ${post.featuredImage.previewAssetPath ? assetVariables.get(post.featuredImage.previewAssetPath) : 'undefined'}, zoom: ${post.featuredImage.zoom}, src: ${assetVariables.get(post.featuredImage.assetPath)} }`
      : 'undefined'
    const assets = [...post.assets].map(
      ([relativePath, assetPath]) =>
        `${JSON.stringify(relativePath)}: ${assetVariables.get(assetPath)}`,
    )
    const codeHighlights = [...post.codeHighlights].map(
      ([line, highlightedHtml]) =>
        `${JSON.stringify(line)}: ${JSON.stringify(highlightedHtml)}`,
    )

    return `{
      categoryName: ${JSON.stringify(post.categoryName)},
      categorySlug: ${JSON.stringify(post.categorySlug)},
      codeHighlights: { ${codeHighlights.join(', ')} },
      content: ${JSON.stringify(post.content)},
      date: ${JSON.stringify(post.date)},
      description: ${JSON.stringify(post.description)},
      featuredImage: ${featuredImage},
      pinned: ${post.pinned},
      readingTime: ${JSON.stringify(post.readingTime)},
      slug: ${JSON.stringify(post.slug)},
      title: ${JSON.stringify(post.title)},
      url: ${JSON.stringify(post.url)},
      assets: { ${assets.join(', ')} }
    }`
  })

  return {
    code: `${imports.join('\n')}

export const categories = ${JSON.stringify(categories)}
export const posts = [${postSource.join(',\n')}]
`,
    watchedFiles,
  }
}

export function blogContentPlugin({
  includeDrafts = false,
  root,
}: BlogContentPluginOptions): Plugin {
  const contentRoot = path.join(root, 'content', 'posts')
  const previewCacheDirectory = path.join(
    root,
    'node_modules',
    '.cache',
    'blog-worldline',
    'previews',
  )

  return {
    name: 'blog-content',
    enforce: 'pre',
    resolveId(id) {
      if (id === virtualModuleId) return resolvedVirtualModuleId
    },
    async load(id) {
      if (id !== resolvedVirtualModuleId) return
      const { code, watchedFiles } = await createVirtualModule(
        contentRoot,
        includeDrafts,
        previewCacheDirectory,
      )
      for (const filePath of watchedFiles) this.addWatchFile(filePath)
      return code
    },
    configureServer(server) {
      server.watcher.add(contentRoot)
    },
    handleHotUpdate(context) {
      if (!normalizePath(context.file).startsWith(normalizePath(contentRoot))) return
      const contentModule = context.server.moduleGraph.getModuleById(resolvedVirtualModuleId)
      if (!contentModule) return
      context.server.moduleGraph.invalidateModule(contentModule)
      context.server.ws.send({ type: 'full-reload' })
      return [contentModule]
    },
  }
}
