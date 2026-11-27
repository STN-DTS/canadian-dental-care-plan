import type { RouteConfig } from '@react-router/dev/routes';

export const routes = [
  {
    id: 'api/jwks',
    file: 'routes/api/jwks.ts',
    path: '/.well-known/jwks.json',
  },
  {
    id: 'api/buildinfo',
    file: 'routes/api/buildinfo.ts',
    path: '/api/buildinfo',
  },
  {
    id: 'api/health',
    file: 'routes/api/health.ts',
    path: '/api/health',
  },
  {
    id: 'api/readyz',
    file: 'routes/api/readyz.ts',
    path: '/api/readyz',
  },
  {
    id: 'api/session',
    file: 'routes/api/session.ts',
    path: '/api/session',
  },
  {
    id: 'api/killswitch',
    file: 'routes/api/killswitch.ts',
    path: '/api/killswitch',
  },
  {
    id: 'api/locales',
    file: 'routes/api/locales.ts',
    path: '/api/locales/:lng/:ns',
  },
] as const satisfies RouteConfig;
