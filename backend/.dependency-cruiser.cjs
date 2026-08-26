/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  extends: '../.dependency-cruiser.cjs',
  options: {
    tsConfig: { fileName: 'tsconfig.json' },
    exclude: {
      path: 'node_modules',
    },
  },
}
