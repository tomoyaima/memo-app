module.exports = {
  globDirectory: 'dist',
  globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest,json}'],
  swSrc: 'build-sw/service-worker.js',
  swDest: 'dist/sw.js',
  injectionPoint: 'self.__WB_MANIFEST',
  maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
}
