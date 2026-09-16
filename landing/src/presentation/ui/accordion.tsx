import type { ComponentProps } from 'react'
import { PlusIcon } from 'lucide-react'
import { Accordion as AccordionPrimitive } from 'radix-ui'
import { cn } from './cn.js'

/**
 * shadcn Accordion without its `border-b` separators — DESIGN.md separates by
 * fill, not strokes. The chevron is a plus in a white disc that springs into
 * a cross when the item opens.
 */
export const Accordion = AccordionPrimitive.Root

export function AccordionItem({ className, ...props }: ComponentProps<typeof AccordionPrimitive.Item>) {
  return <AccordionPrimitive.Item data-slot="accordion-item" className={className} {...props} />
}

export function AccordionTrigger({
  className,
  children,
  ...props
}: ComponentProps<typeof AccordionPrimitive.Trigger>) {
  return (
    <AccordionPrimitive.Header className="flex">
      <AccordionPrimitive.Trigger
        data-slot="accordion-trigger"
        className={cn(
          'group/trigger flex flex-1 cursor-pointer items-center justify-between gap-4 text-left font-bold',
          className,
        )}
        {...props}
      >
        {children}
        <span
          aria-hidden
          className="grid size-11 shrink-0 place-items-center rounded-full bg-ground-white text-ink shadow-list-container transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] group-hover/trigger:scale-110 group-data-[state=open]/trigger:rotate-[135deg]"
        >
          <PlusIcon className="size-5" strokeWidth={2.75} />
        </span>
      </AccordionPrimitive.Trigger>
    </AccordionPrimitive.Header>
  )
}

export function AccordionContent({
  className,
  children,
  ...props
}: ComponentProps<typeof AccordionPrimitive.Content>) {
  return (
    <AccordionPrimitive.Content
      data-slot="accordion-content"
      className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down"
      {...props}
    >
      <div className={className}>{children}</div>
    </AccordionPrimitive.Content>
  )
}
