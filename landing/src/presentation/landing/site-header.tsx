import { ArrowRightIcon } from 'lucide-react'
import { Button } from '../ui/button.js'

const NAV = [
  { href: '#fonctionnalites', label: 'Fonctionnalités' },
  { href: '#demarrer', label: 'Démarrer' },
  { href: '#faq', label: 'FAQ' },
]

export function SiteHeader() {
  return (
    <header className="absolute inset-x-0 top-0 z-20">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-5 py-5 sm:px-8">
        <a href="/" className="flex items-center gap-2.5 rounded-full font-extrabold text-ink">
          <img src="/logo.png" alt="" width={36} height={36} className="size-9 rounded-[10px]" />
          <span className="text-lg tracking-tight">Garde-manger</span>
        </a>
        <nav aria-label="Principale" className="hidden md:block">
          <ul className="flex items-center gap-9 text-[15px] font-medium text-ink">
            {NAV.map((item) => (
              <li key={item.href}>
                <a href={item.href} className="rounded-full hover:text-ink-secondary">
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <Button asChild>
          <a href="#demarrer">
            Commencer <ArrowRightIcon aria-hidden data-motion="nudge" />
          </a>
        </Button>
      </div>
    </header>
  )
}
