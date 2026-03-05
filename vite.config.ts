import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  const gigachatBaseUrl = env.GIGACHAT_BASE_URL || '';

  return {
    base: './',
    resolve: {
      alias: {
        events: 'events',
      },
    },
    build: {
      outDir: 'dist',
      sourcemap: true,
      commonjsOptions: {
        transformMixedEsModules: true,
      },
    },
    server: {
      port: 5173,
      open: false,
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
          target: 'https://lite.duckduckgo.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/ddg-search/, ''),
          secure: true,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
          },
        },
        '/ddg-api': {
          target: 'https://api.duckduckgo.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/ddg-api/, ''),
          secure: true,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'application/json',
          },
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
