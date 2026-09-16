import type { ComponentProps } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { Slot } from 'radix-ui'
import { cn } from './cn.js'

/**
 * shadcn Button, restyled to DESIGN.md: always a full pill, never a border,
 * spring on hover/press. `default` is the lime primary action; `quiet` is the
 * white pill that stands beside it. Icons opt into a hover micro-motion with
 * `data-motion`: `nudge` slides forward, `lift` goes up-right, `wiggle` shakes.
 */
const buttonVariants = cva(
  'group/button spring-press inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-full font-semibold whitespace-nowrap disabled:pointer-events-none disabled:opacity-60 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*=size-])]:size-4 [&_svg]:transition-transform [&_svg]:duration-300 [&_svg]:ease-[cubic-bezier(0.34,1.56,0.64,1)] hover:[&_svg[data-motion=nudge]]:translate-x-1 hover:[&_svg[data-motion=lift]]:translate-x-0.5 hover:[&_svg[data-motion=lift]]:-translate-y-0.5 hover:[&_svg[data-motion=wiggle]]:animate-wiggle',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground',
        quiet: 'bg-ground-white text-ink shadow-card-float',
      },
      size: {
        default: 'h-11 px-5 text-sm',
        lg: 'h-14 px-7 text-base',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
)

export function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: ComponentProps<'button'> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : 'button'
  return <Comp data-slot="button" className={cn(buttonVariants({ variant, size, className }))} {...props} />
}
