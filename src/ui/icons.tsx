import type { SVGProps } from 'react'

export function ArrowIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" {...props}>
      <path d="M3 8h9M8.5 4.5 12 8l-3.5 3.5" />
    </svg>
  )
}

export function CopyIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" {...props}>
      <rect x="5.25" y="5.25" width="7" height="7" rx="1" />
      <path d="M3.75 10.75h-.5a1 1 0 0 1-1-1v-6.5a1 1 0 0 1 1-1h6.5a1 1 0 0 1 1 1v.5" />
    </svg>
  )
}
