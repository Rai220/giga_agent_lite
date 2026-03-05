import { defineConfig, loadEnv } from 'vite';

const host = process.env.TAURI_DEV_HOST;

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  const gigachatBaseUrl = env.GIGACHAT_BASE_URL || '';

  return {
    base: './',
    clearScreen: false,
    resolve: {
      alias: {
        events: 'events',
      },
    },
    build: {
      outDir: 'dist',
      target: process.env.TAURI_ENV_PLATFORM === 'windows' ? 'chrome105' : 'safari13',
      sourcemap: !!process.env.TAURI_ENV_DEBUG,
      commonjsOptions: {
        transformMixedEsModules: true,
      },
    },
    server: {
      port: 5173,
      strictPort: true,
      host: host || false,
      open: false,
      hmr: host ? { protocol: 'ws', host, port: 5174 } : undefined,
      proxy: {
        ...(gigachatBaseUrl
          ? {
              '/gigachat-api': {
                target: gigachatBaseUrl,
                changeOrigin: true,
                rewrite: (path) => path.replace(/^\/gigachat-api/, ''),
                secure: false,
              },
            }
          : {}),
        '/ddg-search': {
          target: 'https://html.duckduckgo.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/ddg-search/, ''),
          secure: true,
        },
      },
    },
    define: {
      __DEV_DEFAULTS__: JSON.stringify({
        gigachat: {
          user: env.GIGACHAT_USER || '',
          password: env.GIGACHAT_PASSWORD || '',
          model: env.GIGACHAT_MODEL || 'GigaChat',
          baseUrl: gigachatBaseUrl ? '/gigachat-api' : '',
          scope: 'GIGACHAT_API_PERS',
        },
      }),
      'process.env': {},
      'process.version': JSON.stringify(''),
      'process.versions': JSON.stringify({}),
    },
  };
});
