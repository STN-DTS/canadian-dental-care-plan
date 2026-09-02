import type { ReporterDescription } from '@playwright/test';
import { defineConfig, devices } from '@playwright/test';

const port = process.env.PORT ?? '3000';

const reporter: ReporterDescription[] = [['list'], ['html']];

export default defineConfig({
  testDir: './e2e',
  timeout: 15 * 1000,
  expect: { timeout: 10 * 1000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [...reporter, ['playwright-teamcity-reporter']] : reporter,
  use: { baseURL: `http://localhost:${port}/`, trace: 'on-first-retry' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'pnpm run start',
    port: Number(port),
    reuseExistingServer: !process.env.CI,
    stdout: 'pipe',
    stderr: 'pipe',
    // prettier-ignore
    env: {
      AUTH_JWT_PRIVATE_KEY: 'MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQCwaAVE/rAjZjCYKBljlVCgQ8uGB3f3twi4UDKpD51IeGwJeVkUG+b2XtUIzgiRro3yjkhfewace5Jn0utODqMIPgSNaQQuH0tIXEgijX1d5ILHrfx8ZkAeLkp2E14pHwZyJrB1tT83Kr/CfvjTuhVbmD2rycL8YGXLInxAXWJnPdT3a6gQtL0X1DuE2zBzJlEKsacRnaiexRmNXxCV+W8hcBgbJHcovjhNqeMMqI5Md2aYk1ZbkiOdNYW9JdcnUIc/4zIZjOBQZW2/XMH4TY+0DFLSbNc6OeJluXB9LnDP92TIR416ZZs47TJEC5VtD8uoPN89HCTNo5dTaWyPeKTTAgMBAAECggEAA0OlWJNhUgu0AMppT+77R1yCFputJF2vUZXxuqIF0NyPONrXuelF9/jle0+ZI7w7ju5Pc0UmON9tGF/Xs6QHGmySLTdnoRnSCCxXWO04zyMxrhrR1Juc80523jGVCRkYDqnNR4R3VLv2/t6KieMawuKBJq0JuUOE3YETYC90QxoIym197Xf13bfPKmIse0AOOrJMOGCxm6CBVALpkgXlzo0ehfP/0mPHqKJ0vC1ETEc+qLinkCBwfihE+mhKu/f/j4E+w48BZKB9Ni2veRmz6wLdH7BSr/4vGF47z1aFpDQNT/aqomtrqvHXFh1yNO8Fu+9GzNgI48DRCi2+xoD4AQKBgQDVkXgLH12KYjIUXn+dpMwegzJGcaNwK8noYBxnArzMHtsSIn3tTaCYOeb/5WiGxdtE1hybc0uhRDQDVwRQrqVCjggikbBnIgarZ0CnAX/JWFtqm4iZrwqXccn4nSGkmxZWoYNoGrF9shQtF37QYxcWs9JEPy7oyxLFEjz6G5JsAQKBgQDTdGstG6GBJlGxuQPk+YGgVlVQ6G8ECWx3uST+XUjSk6FYWtV/LgVStkRufkruBDFaSVYjMHR53yCLJUpGyCc8Uw0IxyNJnu8bQW07oL94kfFJgA5ndlAonWrQWnbIBOQ87RAD5oN5TwyxlqS8V8OGgamdne9m0mFGJhDDhkmg0wKBgHQuQqOqWHSjnqK+FaZotDIVJRB1WXf4Gkqznj/bmWFhl8NxyBeEF004kpW68vX+RJ5Z7A4U1pvQQotelxZdK8HdCkfkAZbZR8+Ox/kSM7YQvwpruhAAzT49xKXetSKay7gs/RNxEgVTDu7IzVAH19Od11ERHi+96WQT2+Ajh7ABAoGBAMV7FpU8Futc9DL8zYxNESjDOE6lpPiqLGjruobsbBRt1+OCgZ2TR1ll7CcdP7FmrQjbMN0QZddj8SrCmsncJ/iIv8WQ5X3eNwTHZ9KmX+uksSmptMofjuE/kwAfXIuVNetIowphgCwNDZfVTuivNmYqNlSDqY/nrv0qk8FnauANAoGAZ7v8TB8GDzYp29MS++ymaOGpgTbX74BRuxGY2wk4xX13Ugxo2sq37afNehxxN0BLjtkie5KDzqEjkCmEb6zTUtJO3bLLnvFgNl+ZD7v8VI0Ehkom3YFCxCdhX8Z6M7ow3OLPilLx6LPyHwWI9yhLQ0q59UlSH0zhUmZqguHudE4=',
      AUTH_JWT_PUBLIC_KEY: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAsGgFRP6wI2YwmCgZY5VQoEPLhgd397cIuFAyqQ+dSHhsCXlZFBvm9l7VCM4Ika6N8o5IX3sGnHuSZ9LrTg6jCD4EjWkELh9LSFxIIo19XeSCx638fGZAHi5KdhNeKR8GciawdbU/Nyq/wn7407oVW5g9q8nC/GBlyyJ8QF1iZz3U92uoELS9F9Q7hNswcyZRCrGnEZ2onsUZjV8QlflvIXAYGyR3KL44TanjDKiOTHdmmJNWW5IjnTWFvSXXJ1CHP+MyGYzgUGVtv1zB+E2PtAxS0mzXOjniZblwfS5wz/dkyEeNemWbOO0yRAuVbQ/LqDzfPRwkzaOXU2lsj3ik0wIDAQAB',
      AUTH_LOGOUT_REDIRECT_URL: 'http://localhost:3000/',
      AUTH_RAOIDC_BASE_URL: 'http://localhost:3000/oidc',
      AUTH_RAOIDC_CLIENT_ID: 'CDCP',
      AUTH_RASCL_LOGOUT_URL: 'http://localhost:3000/',
      ENABLED_FEATURES: "hcaptcha,view-letters,status,show-prototype-banner,doc-upload",
      ENABLED_MOCKS: 'cct,code-tables,document-upload,gc-notify,power-platform,profile,raoidc,status-check,verification-code,wsaddress',
      GC_NOTIFY_API_KEY: '00000000000000000000000000000000',
      HCAPTCHA_SECRET_KEY: '0x0000000000000000000000000000000000000000',
      HCAPTCHA_SITE_KEY: '10000000-ffff-ffff-ffff-000000000001',
      INTEROP_API_BASE_URI: 'https://api.example.com',
      INTEROP_API_SUBSCRIPTION_KEY: '00000000000000000000000000000000',
      MOCK_AUTH_ALLOWED_REDIRECTS: 'http://localhost:3000/auth/callback/raoidc',
      PORT: port,
      SESSION_COOKIE_SECURE: 'false'
    },
  },
});
