import type {
  AnchorHTMLAttributes,
  ButtonHTMLAttributes,
  ReactNode,
} from 'react'
import { ArrowIcon } from '../../icons'
import { cx } from '../../utils'
import styles from './Button.module.css'

type ButtonVariant = 'primary' | 'secondary' | 'ghost'

interface ButtonBaseProps {
  children: ReactNode
  className?: string
  icon?: ReactNode | false
  variant?: ButtonVariant
}

export type ButtonProps =
  | (ButtonBaseProps &
      Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'className'> & {
        href: string
      })
  | (ButtonBaseProps &
      Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className'> & {
        href?: never
      })

export function Button({
  children,
  className,
  icon,
  variant = 'primary',
  ...props
}: ButtonProps) {
  const content = (
    <>
      <span>{children}</span>
      {icon === undefined ? <ArrowIcon className={styles.icon} /> : icon}
    </>
  )
  const classes = cx(styles.button, styles[variant], className)

  if ('href' in props && props.href !== undefined) {
    return (
      <a className={classes} {...props}>
        {content}
      </a>
    )
  }

  return (
    <button className={classes} type="button" {...props}>
      {content}
    </button>
  )
}
