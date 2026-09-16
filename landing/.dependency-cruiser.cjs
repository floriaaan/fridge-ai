/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  extends: '../.dependency-cruiser.cjs',
  forbidden: [
    {
      name: 'routes-must-not-depend-on-infrastructure',
      comment:
        'routes/ is routing only — the connector is wired in providers/, never imported directly.',
      severity: 'error',
      from: { path: '^src/routes' },
      to: { path: '^src/infrastructure' },
    },
  ],
  options: {
    tsConfig: { fileName: 'tsconfig.json' },
    exclude: { path: 'node_modules|\\.test\\.|routeTree\\.gen' },
  },
}
