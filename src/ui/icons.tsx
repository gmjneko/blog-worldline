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

export function BlogIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" {...props}>
      <path d="M4 1.75h5.25L12 4.5v9.75H4z" />
      <path d="M9.25 1.75V4.5H12M6 7h4M6 9.5h4M6 12h2.5" />
    </svg>
  )
}

export function DirectoryIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" {...props}>
      <rect x="2" y="2" width="4.5" height="4.5" />
      <rect x="9.5" y="2" width="4.5" height="4.5" />
      <rect x="2" y="9.5" width="4.5" height="4.5" />
      <path d="M9.5 11.75H14M11.75 9.5V14" />
    </svg>
  )
}

export function CabinIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" {...props}>
      <path d="m2 7 6-5 6 5M3.5 6v8h9V6M6.5 14v-4h3v4" />
    </svg>
  )
}

export function FriendsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" {...props}>
      <path d="M6.25 9.75 4.5 11.5a2.12 2.12 0 0 1-3-3l2.25-2.25a2.12 2.12 0 0 1 3 0M9.75 6.25l1.75-1.75a2.12 2.12 0 0 1 3 3l-2.25 2.25a2.12 2.12 0 0 1-3 0M5.5 10.5l5-5" />
    </svg>
  )
}

export function GitHubIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" {...props}>
      <path
        fill="currentColor"
        stroke="none"
        fillRule="evenodd"
        d="M8 .8a7.38 7.38 0 0 0-2.33 14.38c.37.07.5-.16.5-.36v-1.43c-2.06.45-2.5-.87-2.5-.87-.33-.86-.82-1.08-.82-1.08-.67-.46.05-.45.05-.45.74.05 1.14.77 1.14.77.66 1.14 1.73.81 2.15.62.07-.48.26-.81.47-1-1.65-.19-3.38-.83-3.38-3.65 0-.81.29-1.47.76-1.99-.08-.18-.33-.93.07-1.96 0 0 .62-.2 2.03.76A7 7 0 0 1 8 4.49c.63 0 1.25.08 1.84.25 1.41-.96 2.03-.76 2.03-.76.4 1.03.15 1.78.07 1.96.47.52.76 1.18.76 1.99 0 2.83-1.74 3.46-3.39 3.64.27.23.5.69.5 1.39v1.86c0 .2.14.43.51.36A7.38 7.38 0 0 0 8 .8Z"
      />
    </svg>
  )
}
