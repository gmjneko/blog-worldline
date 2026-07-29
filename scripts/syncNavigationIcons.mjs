import { mkdir, readdir, readFile, rename, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml'

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(scriptDirectory, '..')
const configPath = path.join(projectRoot, 'content', 'navigation.yml')
const iconDirectory = path.join(projectRoot, 'public', 'navigation-icons')
const iconPublicPath = '/navigation-icons'
const requestTimeout = 8_000
const maximumIconBytes = 1_000_000
const concurrency = 6
const browserUserAgent =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseTagAttributes(tag) {
  const attributes = new Map()
  const pattern = /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g

  for (const match of tag.matchAll(pattern)) {
    const name = match[1].toLowerCase()
    if (name === 'link' || name === 'base') continue
    attributes.set(name, match[2] ?? match[3] ?? match[4] ?? '')
  }

  return attributes
}

function candidateScore(attributes, faviconUrl) {
  const rel = attributes.get('rel')?.toLowerCase() ?? ''
  const sizes = attributes.get('sizes')?.toLowerCase() ?? ''
  const type = attributes.get('type')?.toLowerCase() ?? ''
  let score = 0

  if (rel.split(/\s+/).includes('icon')) score += 100
  if (rel.includes('shortcut')) score += 8
  if (rel.includes('apple-touch-icon')) score -= 20
  if (rel.includes('mask-icon')) score -= 30
  if (type === 'image/svg+xml' || faviconUrl.endsWith('.svg')) score += 18
  if (/\b(?:32|48|64)x(?:32|48|64)\b/.test(sizes)) score += 16
  if (sizes === 'any') score += 12
  if (faviconUrl.toLowerCase().includes('favicon')) score += 6

  return score
}

function findDeclaredIcons(html, responseUrl) {
  const baseTag = html.match(/<base\b[^>]*>/i)?.[0]
  const baseHref = baseTag ? parseTagAttributes(baseTag).get('href') : undefined
  let documentBaseUrl = responseUrl

  if (baseHref) {
    try {
      documentBaseUrl = new URL(baseHref, responseUrl).href
    } catch {
      // Invalid base URLs do not prevent the normal response URL fallback.
    }
  }

  const candidates = []
  for (const tag of html.match(/<link\b[^>]*>/gi) ?? []) {
    const attributes = parseTagAttributes(tag)
    const rel = attributes.get('rel')?.toLowerCase() ?? ''
    const href = attributes.get('href')
    if (!href || !rel.includes('icon')) continue

    try {
      const faviconUrl = new URL(href, documentBaseUrl)
      if (!['http:', 'https:', 'data:'].includes(faviconUrl.protocol)) continue
      candidates.push({
        score: candidateScore(attributes, faviconUrl.href),
        url: faviconUrl.href,
      })
    } catch {
      // Ignore malformed icon declarations.
    }
  }

  return candidates
    .sort((first, second) => second.score - first.score)
    .map((candidate) => candidate.url)
}

async function discoverIconCandidates(pageUrl) {
  let responseUrl = pageUrl
  let declaredIcons = []

  try {
    const response = await fetch(pageUrl, {
      headers: {
        accept: 'text/html,application/xhtml+xml',
        'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'user-agent': browserUserAgent,
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(requestTimeout),
    })

    if (response.ok) {
      responseUrl = response.url || pageUrl
      const contentType = response.headers.get('content-type') ?? ''
      if (!contentType || contentType.includes('html')) {
        const html = (await response.text()).slice(0, 800_000)
        declaredIcons = findDeclaredIcons(html, responseUrl)
      }
    }
  } catch {
    // Sites may block homepage requests; the standard favicon path is still tried.
  }

  return [
    ...new Set([
      ...declaredIcons.slice(0, 5),
      new URL('/favicon.ico', responseUrl).href,
      new URL('/favicon.ico', pageUrl).href,
    ]),
  ]
}

function detectImageExtension(bytes, contentType, sourceUrl) {
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return '.png'
  }
  if (
    bytes.length >= 4 &&
    bytes[0] === 0x00 &&
    bytes[1] === 0x00 &&
    bytes[2] === 0x01 &&
    bytes[3] === 0x00
  ) {
    return '.ico'
  }
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) {
    return '.jpg'
  }

  const header = new TextDecoder().decode(bytes.slice(0, 300)).trimStart()
  const normalizedHeader = header.toLowerCase()
  if (
    normalizedHeader.startsWith('<!doctype html') ||
    normalizedHeader.startsWith('<html')
  ) {
    return undefined
  }
  if (
    header.startsWith('<svg') ||
    (header.startsWith('<?xml') && header.includes('<svg'))
  ) {
    return '.svg'
  }
  if (header.startsWith('GIF8')) return '.gif'
  if (header.startsWith('RIFF') && header.slice(8, 12) === 'WEBP') return '.webp'
  if (header.slice(4, 12).includes('ftypavif')) return '.avif'

  const normalizedContentType = contentType.split(';', 1)[0].trim().toLowerCase()
  const extensions = {
    'image/avif': '.avif',
    'image/gif': '.gif',
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/svg+xml': '.svg',
    'image/vnd.microsoft.icon': '.ico',
    'image/webp': '.webp',
    'image/x-icon': '.ico',
  }
  if (extensions[normalizedContentType]) return extensions[normalizedContentType]

  try {
    const extension = path.extname(new URL(sourceUrl).pathname).toLowerCase()
    if (
      ['.avif', '.gif', '.ico', '.jpeg', '.jpg', '.png', '.svg', '.webp'].includes(
        extension,
      )
    ) {
      return extension === '.jpeg' ? '.jpg' : extension
    }
  } catch {
    // Data URLs without a recognized image type are rejected below.
  }

  return undefined
}

async function downloadIcon(sourceUrl, pageUrl) {
  try {
    const response = await fetch(sourceUrl, {
      headers: {
        accept: 'image/avif,image/webp,image/svg+xml,image/png,image/*,*/*;q=0.8',
        referer: pageUrl,
        'user-agent': browserUserAgent,
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(requestTimeout),
    })
    if (!response.ok) return undefined

    const contentType = response.headers.get('content-type') ?? ''
    if (contentType.toLowerCase().includes('text/html')) return undefined

    const bytes = new Uint8Array(await response.arrayBuffer())
    if (bytes.length === 0 || bytes.length > maximumIconBytes) return undefined

    const extension = detectImageExtension(
      bytes,
      contentType,
      response.url || sourceUrl,
    )
    if (!extension) return undefined

    return { bytes, extension, sourceUrl: response.url || sourceUrl }
  } catch {
    return undefined
  }
}

function iconFileBase(site) {
  return (
    site.name
      .trim()
      .normalize('NFKC')
      .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '-')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^[.-]+|[.-]+$/g, '') || 'site'
  )
}

function generatedIconFileName(icon) {
  const prefix = `${iconPublicPath}/`
  if (!icon.startsWith(prefix)) return undefined
  const fileName = icon.slice(prefix.length)
  if (
    !fileName ||
    fileName === '.' ||
    fileName === '..' ||
    path.basename(fileName) !== fileName
  ) {
    return undefined
  }
  return fileName
}

async function isFile(filePath) {
  try {
    return (await stat(filePath)).isFile()
  } catch {
    return false
  }
}

async function findExistingNamedIcon(site) {
  const expectedBase = iconFileBase(site).toLocaleLowerCase()
  const entries = await readdir(iconDirectory, { withFileTypes: true })
  const match = entries.find((entry) => {
    if (!entry.isFile()) return false
    const extension = path.extname(entry.name)
    if (!extension) return false
    return entry.name.slice(0, -extension.length).toLocaleLowerCase() === expectedBase
  })
  return match?.name
}

async function syncSiteIcon(site) {
  const candidates = await discoverIconCandidates(site.url)
  const attempts = await Promise.all(
    candidates.map((candidate) => downloadIcon(candidate, site.url)),
  )
  const icon = attempts.find((attempt) => attempt !== undefined)
  if (!icon) return { site, success: false }

  const fileName = `${iconFileBase(site)}${icon.extension}`
  await writeFile(path.join(iconDirectory, fileName), icon.bytes)
  site.icon = `${iconPublicPath}/${fileName}`
  return {
    fileName,
    site,
    sourceUrl: icon.sourceUrl,
    success: true,
  }
}

async function mapWithConcurrency(values, limit, mapper) {
  const results = new Array(values.length)
  let nextIndex = 0

  async function worker() {
    while (nextIndex < values.length) {
      const currentIndex = nextIndex
      nextIndex += 1
      results[currentIndex] = await mapper(values[currentIndex])
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, values.length) }, () => worker()),
  )
  return results
}

async function main() {
  const source = await readFile(configPath, 'utf8')
  const config = parseYaml(source)
  if (!isRecord(config) || !Array.isArray(config.categories)) {
    throw new Error('content/navigation.yml 必须包含 categories 数组。')
  }

  const sites = config.categories.flatMap((category, categoryIndex) => {
    if (!isRecord(category) || !Array.isArray(category.sites)) {
      throw new Error(`categories[${categoryIndex}] 必须包含 sites 数组。`)
    }
    return category.sites.map((site, siteIndex) => {
      if (
        !isRecord(site) ||
        typeof site.name !== 'string' ||
        typeof site.url !== 'string'
      ) {
        throw new Error(
          `categories[${categoryIndex}].sites[${siteIndex}] 缺少 name 或 url。`,
        )
      }
      return site
    })
  })

  await mkdir(iconDirectory, { recursive: true })

  const fileNameOwners = new Map()
  for (const site of sites) {
    const fileNameKey = iconFileBase(site).toLocaleLowerCase()
    const existingOwner = fileNameOwners.get(fileNameKey)
    if (existingOwner) {
      throw new Error(
        `站点名称“${existingOwner}”和“${site.name}”会生成相同的图标文件名，请修改其中一个 name。`,
      )
    }
    fileNameOwners.set(fileNameKey, site.name)
  }

  const pendingSites = []
  const reusedSites = []
  const renamedSites = []
  let skippedCount = 0
  let configChanged = false

  for (const site of sites) {
    const configuredIcon =
      typeof site.icon === 'string' ? site.icon.trim() : ''
    const generatedFileName = generatedIconFileName(configuredIcon)

    if (generatedFileName) {
      const currentPath = path.join(iconDirectory, generatedFileName)
      if (await isFile(currentPath)) {
        const extension = path.extname(generatedFileName)
        const expectedFileName = `${iconFileBase(site)}${extension}`
        if (generatedFileName !== expectedFileName) {
          const expectedPath = path.join(iconDirectory, expectedFileName)
          if (!(await isFile(expectedPath))) {
            await rename(currentPath, expectedPath)
          }
          site.icon = `${iconPublicPath}/${expectedFileName}`
          renamedSites.push(site)
          configChanged = true
        } else {
          skippedCount += 1
        }
        continue
      }

      site.icon = ''
      configChanged = true
    } else if (configuredIcon) {
      skippedCount += 1
      continue
    }

    const existingFileName = await findExistingNamedIcon(site)
    if (existingFileName) {
      site.icon = `${iconPublicPath}/${existingFileName}`
      reusedSites.push(site)
      configChanged = true
      continue
    }

    pendingSites.push(site)
  }

  console.log(
    `开始同步 ${pendingSites.length} 个站点图标，复用 ${reusedSites.length} 个，重命名 ${renamedSites.length} 个，跳过 ${skippedCount} 个。`,
  )

  const results = await mapWithConcurrency(
    pendingSites,
    concurrency,
    syncSiteIcon,
  )
  const successful = results.filter((result) => result.success)
  const failed = results.filter((result) => !result.success)

  if (configChanged || successful.length > 0) {
    await writeFile(configPath, stringifyYaml(config, { lineWidth: 0 }), 'utf8')
  }

  for (const site of renamedSites) {
    console.log(`↪ ${site.name} -> ${site.icon}`)
  }

  for (const site of reusedSites) {
    console.log(`• ${site.name} -> ${site.icon}`)
  }

  for (const result of successful) {
    console.log(`✓ ${result.site.name} -> ${result.site.icon}`)
  }

  if (failed.length > 0) {
    console.log('\n以下站点未能自动获取图标，请在 YAML 的 icon 字段中手动配置：')
    for (const result of failed) {
      console.log(`- ${result.site.name}: ${result.site.url}`)
    }
  }

  console.log(
    `\n完成：下载 ${successful.length}，复用 ${reusedSites.length}，重命名 ${renamedSites.length}，失败 ${failed.length}，跳过 ${skippedCount}。`,
  )
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
