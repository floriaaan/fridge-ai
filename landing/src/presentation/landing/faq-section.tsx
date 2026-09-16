import { ArrowUpRightIcon } from 'lucide-react'
import type { LandingContent } from '../../domain/content/landing-content.js'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../ui/accordion.js'
import { Button } from '../ui/button.js'
import { cn } from '../ui/cn.js'
import { CORNERS } from '../ui/corners.js'
import { illustrationSrc } from './illustration.js'
import { ScribbleUnderline } from './scribble-underline.js'

/** The pastel trio, always cycled together (DESIGN.md), each with its own text tone. */
const TONES = [
  { corners: CORNERS.a, surface: 'bg-cream', text: 'text-cream-text' },
  { corners: CORNERS.b, surface: 'bg-lavender', text: 'text-lavender-text' },
  { corners: CORNERS.c, surface: 'bg-mint-pale', text: 'text-mint-pale-text' },
] as const

export function FaqSection({ content }: { content: LandingContent }) {
  const { faq, repositoryUrl, ui } = content
  return (
    <section
      id="faq"
      aria-labelledby="faq-title"
      className="mx-auto grid max-w-7xl scroll-mt-8 gap-12 px-5 py-24 sm:px-8 lg:grid-cols-[1fr_1.5fr] lg:gap-16"
    >
      <div className="relative lg:sticky lg:top-10 lg:self-start">
        <img
          src={illustrationSrc('pot-of-food')}
          alt=""
          width={88}
          height={88}
          className="pointer-events-none absolute -top-10 right-2 size-20 rotate-12 sm:size-22 lg:-right-4"
        />
        <h2
          id="faq-title"
          className="text-6xl leading-[0.95] font-extrabold tracking-[-0.045em] text-ink sm:text-7xl xl:text-8xl"
        >
          {ui.faq.headingBefore}{' '}
          <ScribbleUnderline>{ui.faq.headingHighlight}</ScribbleUnderline>
          {ui.faq.headingAfter}
        </h2>
        <p className="mt-8 max-w-sm text-lg text-ink/75">{ui.faq.subtitle}</p>
        <Button asChild variant="quiet" size="lg" className="mt-8">
          <a href={`${repositoryUrl}/issues`}>
            {ui.faq.askYours} <ArrowUpRightIcon aria-hidden data-motion="lift" />
          </a>
        </Button>
      </div>

      <Accordion type="single" collapsible className="space-y-4">
        {faq.map((entry, index) => {
          const tone = TONES[index % TONES.length] ?? TONES[0]
          return (
            <AccordionItem
              key={entry.question}
              value={entry.question}
              className={cn(
                tone.corners,
                tone.surface,
                'transition-[box-shadow,translate] duration-300 hover:-translate-y-0.5 data-[state=open]:shadow-card-float',
              )}
            >
              <AccordionTrigger className="gap-5 px-6 py-6 sm:px-8 sm:py-7">
                <span className="flex items-baseline gap-4 sm:gap-6">
                  <span aria-hidden className={cn('text-3xl font-extrabold tabular-nums sm:text-4xl', tone.text)}>
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span className="text-xl leading-snug font-extrabold tracking-tight text-ink sm:text-2xl">
                    {entry.question}
                  </span>
                </span>
              </AccordionTrigger>
              <AccordionContent
                className={cn('px-6 pb-7 text-lg leading-relaxed sm:pr-20 sm:pb-8 sm:pl-[5.75rem]', tone.text)}
              >
                {entry.answer}
              </AccordionContent>
            </AccordionItem>
          )
        })}
      </Accordion>
    </section>
  )
}
