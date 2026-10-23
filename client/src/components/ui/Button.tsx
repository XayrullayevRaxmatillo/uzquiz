import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { Link, type LinkProps } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { Loader2 } from 'lucide-react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

const base =
  'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-colors select-none disabled:opacity-50 disabled:pointer-events-none'
const sizes: Record<Size, string> = {
  sm: 'h-9 px-3.5 text-sm',
  md: 'h-11 px-5 text-sm',
  lg: 'h-13 px-7 text-base min-h-[3.25rem]',
}
const variants: Record<Variant, string> = {
  primary: 'btn-primary hover:brightness-110',
  secondary: 'bg-surface2 border border-line text-fg hover:border-line-strong',
  ghost: 'text-muted hover:text-fg hover:bg-surface2',
  danger: 'bg-bad text-white hover:brightness-110',
}

export function buttonClass(variant: Variant = 'primary', size: Size = 'md', extra = '') {
  return `${base} ${sizes[size]} ${variants[variant]} ${extra}`
}

interface Props extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onDrag' | 'onDragStart' | 'onDragEnd' | 'onAnimationStart'> {
  variant?: Variant
  size?: Size
  loading?: boolean
}

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = 'primary', size = 'md', loading, disabled, className = '', children, ...rest },
  ref,
) {
  const reduce = useReducedMotion()
  return (
    <motion.button
      ref={ref}
      whileHover={reduce ? undefined : { y: -1 }}
      whileTap={reduce ? undefined : { scale: 0.97 }}
      className={buttonClass(variant, size, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </motion.button>
  )
})

interface LinkBtnProps extends LinkProps {
  variant?: Variant
  size?: Size
}
export function LinkButton({ variant = 'primary', size = 'md', className = '', ...rest }: LinkBtnProps) {
  return <Link className={buttonClass(variant, size, className)} {...rest} />
}
