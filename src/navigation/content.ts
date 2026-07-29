import { parse as parseYaml } from 'yaml'
import navigationSource from '../../content/navigation.yml?raw'

export interface NavigationSite {
  description: string
  icon: string
  name: string
  url: string
}

export interface NavigationCategory {
  description: string
  name: string
  sites: NavigationSite[]
}

function fail(path: string, message: string): never {
  throw new Error(`[navigation-content] ${path}: ${message}`)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function requiredString(
  record: Record<string, unknown>,
  key: string,
  path: string,
) {
  const value = record[key]
  if (typeof value !== 'string' || value.trim() === '') {
    fail(path, `字段“${key}”必须是非空字符串。`)
  }
  return value.trim()
}

function optionalString(
  record: Record<string, unknown>,
  key: string,
  path: string,
) {
  const value = record[key]
  if (value === undefined || value === null || value === '') return ''
  if (typeof value !== 'string') {
    fail(path, `字段“${key}”必须是字符串或留空。`)
  }
  return value.trim()
}

function parseNavigationSource(source: string): NavigationCategory[] {
  const parsed = parseYaml(source)
  if (!isRecord(parsed) || !Array.isArray(parsed.categories)) {
    fail('categories', '配置文件必须包含 categories 数组。')
  }

  return parsed.categories.map((categoryValue, categoryIndex) => {
    const categoryPath = `categories[${categoryIndex}]`
    if (!isRecord(categoryValue)) {
      fail(categoryPath, '分类必须是一个对象。')
    }
    if (!Array.isArray(categoryValue.sites)) {
      fail(`${categoryPath}.sites`, '分类必须包含 sites 数组。')
    }

    const sites = categoryValue.sites.map((siteValue, siteIndex) => {
      const sitePath = `${categoryPath}.sites[${siteIndex}]`
      if (!isRecord(siteValue)) {
        fail(sitePath, '站点必须是一个对象。')
      }

      const url = requiredString(siteValue, 'url', sitePath)
      try {
        const parsedUrl = new URL(url)
        if (!['http:', 'https:'].includes(parsedUrl.protocol)) throw new Error()
      } catch {
        fail(sitePath, '字段“url”必须是有效的 HTTP 或 HTTPS 地址。')
      }

      return {
        description: optionalString(siteValue, 'description', sitePath),
        icon: optionalString(siteValue, 'icon', sitePath),
        name: requiredString(siteValue, 'name', sitePath),
        url,
      }
    })

    return {
      description: optionalString(categoryValue, 'description', categoryPath),
      name: requiredString(categoryValue, 'name', categoryPath),
      sites,
    }
  })
}

export const navigationCategories = parseNavigationSource(navigationSource)
