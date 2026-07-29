import type { Image, Parent, Root, Text } from 'mdast'
import type { Plugin } from 'unified'

const imageWidthPattern = /^\{width\s*=\s*(\d+(?:\.\d+)?)(px|%)\s*\}/

function applyImageWidths(parent: Parent) {
  for (let index = 0; index < parent.children.length; index += 1) {
    const child = parent.children[index]
    const attribute = parent.children[index + 1]

    if (child.type === 'image' && attribute?.type === 'text') {
      const match = imageWidthPattern.exec(attribute.value)

      if (match && Number(match[1]) > 0) {
        const width = `${match[1]}${match[2]}`
        const image = child as Image
        const text = attribute as Text

        image.data = {
          ...image.data,
          hProperties: {
            ...image.data?.hProperties,
            style: `width: ${width};`,
          },
        }

        text.value = text.value.slice(match[0].length)
        if (!text.value) parent.children.splice(index + 1, 1)
      }
    }

    if ('children' in child) applyImageWidths(child as Parent)
  }
}

export const remarkImageSize: Plugin<[], Root> = () => (tree) => {
  applyImageWidths(tree)
}
