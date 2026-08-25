/**
 * Shared boundary rules (cf. docs/adr/0002). Layer folders live under each
 * package's own `src/`, so every path pattern here is relative to that
 * package's `src/` — extended by backend/.dependency-cruiser.cjs (and later
 * mobile/.dependency-cruiser.cjs), which add their own `options.tsConfig`/`exclude`.
 */
module.exports = {
  forbidden: [
    {
      name: 'domain-has-zero-dependencies',
      comment:
        'domain must not depend on any other layer, and must not depend on any npm package ' +
        '(cf. docs/phase-0/02-modele-de-domaine.md).',
      severity: 'error',
      from: { path: '^src/domain' },
      to: { pathNot: '^src/domain' },
    },
    {
      name: 'application-only-depends-on-domain',
      comment: 'application must not depend on infrastructure or presentation.',
      severity: 'error',
      from: { path: '^src/application' },
      to: { path: '^src/(infrastructure|presentation)' },
    },
    {
      name: 'infrastructure-must-not-depend-on-presentation',
      comment: 'infrastructure may depend on domain and application, never on presentation.',
      severity: 'error',
      from: { path: '^src/infrastructure' },
      to: { path: '^src/presentation' },
    },
    {
      name: 'presentation-must-not-depend-on-infrastructure',
      comment:
        'presentation may depend on domain and application; wiring to infrastructure ' +
        'implementations happens in providers/, outside src/, never via a direct import.',
      severity: 'error',
      from: { path: '^src/presentation' },
      to: { path: '^src/infrastructure' },
    },
    {
      name: 'no-circular',
      comment: 'Circular imports make the layering hard to reason about.',
      severity: 'warn',
      from: {},
      to: { circular: true },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsPreCompilationDeps: true,
  },
}
