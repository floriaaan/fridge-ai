import { ArrowRightIcon } from 'lucide-react'
import { Button } from '../ui/button.js'
import { GithubIcon } from '../ui/github-icon.js'
import { illustrationSrc } from './illustration.js'
import { ScribbleUnderline } from './scribble-underline.js'

/**
 * A closing call to action on a mint card that bookends the hero, with the
 * links, a clipped giant wordmark and the illustration credit.
 */
export function SiteFooter({ repositoryUrl }: { repositoryUrl: string }) {
  const columns = [
    {
      title: 'L’app',
      links: [
        { href: '#fonctionnalites', label: 'Fonctionnalités' },
        { href: '#demarrer', label: 'Deux façons de s’y mettre' },
        { href: '#faq', label: 'Questions fréquentes' },
      ],
    },
    {
      title: 'Le projet',
      links: [
        { href: repositoryUrl, label: 'GitHub' },
        { href: '#auto-hebergement', label: 'Auto-hébergement' },
        { href: `${repositoryUrl}/blob/main/LICENSE`, label: 'Licence MIT' },
        { href: `${repositoryUrl}/issues`, label: 'Signaler un problème' },
      ],
    },
  ]

  return (
    <footer className="p-3 sm:p-5">
      <div
        className="corners-hero relative overflow-hidden"
        style={{
          backgroundImage:
            'radial-gradient(45% 60% at 100% 0%, rgb(191 238 122 / 0.55), transparent 70%), linear-gradient(#e9f6d8, #e9f6d8)',
        }}
      >
        <img
          src={illustrationSrc('carrot')}
          alt=""
          width={80}
          height={80}
          className="pointer-events-none absolute top-10 right-[8%] hidden size-20 rotate-12 lg:block"
        />
        <img
          src={illustrationSrc('shopping-cart')}
          alt=""
          width={64}
          height={64}
          className="pointer-events-none absolute top-44 right-[30%] hidden size-16 -rotate-12 lg:block"
        />

        <div className="relative mx-auto grid max-w-7xl gap-14 px-6 pt-16 sm:px-10 sm:pt-20 lg:grid-cols-[1.5fr_1fr]">
          <div>
            <p className="max-w-2xl text-4xl leading-[1] font-extrabold tracking-[-0.045em] text-balance text-ink sm:text-6xl">
              Plus rien ne se perd <ScribbleUnderline>au fond du frigo</ScribbleUnderline>.
            </p>
            <div className="mt-10 flex flex-wrap gap-4">
              <Button asChild size="lg">
                <a href="#demarrer">
                  Commencer <ArrowRightIcon aria-hidden data-motion="nudge" />
                </a>
              </Button>
              <Button asChild size="lg" variant="quiet">
                <a href={repositoryUrl}>
                  <GithubIcon data-motion="wiggle" /> Voir sur GitHub
                </a>
              </Button>
            </div>
          </div>

          <nav aria-label="Pied de page" className="grid grid-cols-2 gap-8 lg:pt-3">
            {columns.map((column) => (
              <div key={column.title}>
                <p className="text-sm font-bold tracking-wide text-ink/70 uppercase">{column.title}</p>
                <ul className="mt-4 space-y-3 text-[17px] font-semibold text-ink">
                  {column.links.map((link) => (
                    <li key={link.label}>
                      <a
                        href={link.href}
                        className="inline-block rounded-sm transition-transform duration-300 hover:translate-x-1 hover:underline hover:decoration-blob-strong hover:decoration-4 hover:underline-offset-4"
                      >
                        {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        <div className="relative mx-auto mt-16 flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 text-sm text-ink/80 sm:px-10">
          <p className="flex items-center gap-2.5 font-extrabold text-ink">
            <img src="/logo.png" alt="" width={28} height={28} className="size-7 rounded-[8px]" />
            Garde-manger · open source, licence MIT
          </p>
          <p>Illustrations : Fluent Emoji © Microsoft, licence MIT.</p>
        </div>

        <p
          aria-hidden
          className="pointer-events-none mt-4 -mb-[0.22em] text-center text-[12.5vw] leading-none font-extrabold tracking-[-0.06em] whitespace-nowrap text-blob-strong select-none"
        >
          Garde-manger
        </p>
      </div>
    </footer>
  )
}
