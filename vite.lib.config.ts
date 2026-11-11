import { fileURLToPath, URL } from 'node:url'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

/**
 * Build de la bibliotheque d'integration, separe de celui de l'application.
 *
 * Sortie volontairement dans `dist-lib/` : `pnpm build` continue de produire le
 * site dans `dist/`, et les deux commandes ne se marchent pas dessus. Le module
 * est autonome — Vue est embarque — pour qu'une page quelconque puisse le
 * charger sans installateur de paquets ni import map.
 */
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) }
  },
  /*
   * Une page sans bundler n'a pas de `process` : Vue est livre en build
   * `esm-bundler` et attend que l'outil remplace ce drapeau. En mode
   * bibliotheque Vite ne le fait pas tout seul, et le module echouerait au
   * chargement avec `process is not defined`.
   */
  define: {
    'process.env.NODE_ENV': JSON.stringify('production')
  },
  build: {
    outDir: 'dist-lib',
    emptyOutDir: true,
    target: 'es2020',
    lib: {
      entry: fileURLToPath(new URL('./src/embed/index.ts', import.meta.url)),
      formats: ['es'],
      fileName: () => 'bloub-avatar.js'
    }
  }
})
