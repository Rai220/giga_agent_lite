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
