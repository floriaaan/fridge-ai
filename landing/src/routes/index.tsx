import { createFileRoute } from '@tanstack/react-router'
import { landingContentQuery } from '../application/content/landing-content.query.js'
import { LandingPage } from '../presentation/landing/landing-page.js'

export const Route = createFileRoute('/')({
  // Content is prefetched so it is in the server-rendered HTML; instance stats
  // and GitHub are read in the browser and never hold the page back.
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(landingContentQuery.options(context.connector)),
  component: LandingPage,
})
