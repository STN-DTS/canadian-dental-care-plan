import type { ReadonlyDeep } from 'type-fest';
import * as z from 'zod';

import { isValidTimeZone } from '~/utils/date-utils';
import { isValidExtension } from '~/utils/file-utils';

const validFeatureNames = ['hcaptcha', 'killswitch-api', 'show-prototype-banner', 'stub-login', 'status', 'view-letters', 'view-payload', 'doc-upload'] as const;

export type FeatureName = (typeof validFeatureNames)[number];

// refiners
const areValidFeatureNames = (arr: Array<string>): arr is FeatureName[] => arr.every((featureName) => validFeatureNames.includes(featureName as FeatureName));

// transformers
const csvToArray = (csv?: string) => csv?.split(',').map((str) => str.trim()) ?? [];
const emptyToUndefined = (val?: string) => (val === '' ? undefined : val);
const toBoolean = (val?: string) => val === 'true';

/**
 * Environment variables that are safe to expose publicly to the client.
 * ⚠️ IMPORTANT: DO NOT PUT SENSITIVE CONFIGURATIONS HERE ⚠️
 */
// prettier-ignore
export const clientEnvSchema = z.object({
  // Adobe Analytics scripts
  ADOBE_ANALYTICS_SRC: z.url().optional(),
  ADOBE_ANALYTICS_JQUERY_SRC: z.url().default('https://code.jquery.com/jquery-3.7.1.min.js'),

  BUILD_DATE: z.string().default('1970-01-01T00:00:00.000Z'),
  BUILD_ID: z.string().default('000000'),
  BUILD_REVISION: z.string().default('00000000'),
  BUILD_VERSION: z.string().default('0.0.0-000000-00000000'),

  ENABLED_FEATURES: z.string().transform(emptyToUndefined).transform(csvToArray).refine(areValidFeatureNames).default([]),

  TIME_ZONE: z.string().trim().min(1).refine(isValidTimeZone).default('Canada/Eastern'),

  I18NEXT_DEBUG: z.string().transform(toBoolean).default(false),

  // base URIs for My Service Canada Account variations
  ECAS_BASE_URI: z.url().default('https://srv136.services.gc.ca/ecas-seca/rascl/SCL'),
  SCCH_BASE_URI: z.url().default('https://service.canada.ca'),

  // Header Logo URLs
  HEADER_LOGO_URL_EN: z.url().default('https://canada.ca/en'),
  HEADER_LOGO_URL_FR: z.url().default('https://canada.ca/fr'),

  // hCaptcha settings (@see https://docs.hcaptcha.com/#test-key-set-enterprise-account-safe-end-user)
  HCAPTCHA_SITE_KEY: z.string().trim().min(1).default('20000000-ffff-ffff-ffff-000000000002'),

  SESSION_TIMEOUT_SECONDS: z.coerce.number().min(0).default(19 * 60),
  SESSION_TIMEOUT_PROMPT_SECONDS: z.coerce.number().min(0).default(5 * 60),

  // lookup identifiers
  CANADA_COUNTRY_ID: z.string().trim().min(1).default('0cf5389e-97ae-eb11-8236-000d3af4bfc3'),
  USA_COUNTRY_ID: z.string().trim().min(1).default('fcf7389e-97ae-eb11-8236-000d3af4bfc3'),
  COMMUNICATION_METHOD_SUNLIFE_EMAIL_ID: z.string().trim().min(1).default('775170000'),
  COMMUNICATION_METHOD_SUNLIFE_MAIL_ID: z.string().trim().min(1).default('775170002'),
  COMMUNICATION_METHOD_GC_DIGITAL_ID: z.string().trim().min(1).default('775170000'),
  COMMUNICATION_METHOD_GC_MAIL_ID: z.string().trim().min(1).default('775170002'),
  CLIENT_STATUS_SUCCESS_ID: z.string().trim().min(1).default('51af5170-614e-ee11-be6f-000d3a09d640'),
  INVALID_CLIENT_FRIENDLY_STATUS: z.string().trim().min(1).default('504fba6e-604e-ee11-be6f-000d3a09d640'),
  INVALID_LETTER_TYPE_IDS: z.string().trim().transform(csvToArray).default(['775170000']),
  MARITAL_STATUS_CODE_SINGLE: z.string().trim().min(1).default("775170000"),
  MARITAL_STATUS_CODE_MARRIED: z.string().trim().min(1).default("775170001"),
  MARITAL_STATUS_CODE_COMMON_LAW: z.string().trim().min(1).default("775170002"),
  MARITAL_STATUS_CODE_SEPARATED: z.string().trim().min(1).default("775170003"),
  MARITAL_STATUS_CODE_DIVORCED: z.string().trim().min(1).default("775170004"),
  MARITAL_STATUS_CODE_WIDOWED: z.string().trim().min(1).default("775170005"),

  // CDCP Survey URLs
  CDCP_SURVEY_LINK_EN: z.url().default('https://forms-formulaires.alpha.canada.ca/en/id/cmdsycga6008qx701dw5x5n9c'),
  CDCP_SURVEY_LINK_FR: z.url().default('https://forms-formulaires.alpha.canada.ca/fr/id/cmdsycga6008qx701dw5x5n9c'),

  // Document upload configs
  DOCUMENT_UPLOAD_ALLOWED_FILE_EXTENSIONS: z.string().trim().toLowerCase().default('.docx,.pptx,.txt,.pdf,.jpg,.jpeg,.png')
    .transform(csvToArray)
    .transform((val) => [...new Set(val)]) // remove duplicates
    .pipe(z.array(z.string().refine(isValidExtension)).min(1)),
  DOCUMENT_UPLOAD_MAX_FILE_SIZE_MB: z.coerce.number().positive().default(5),
  DOCUMENT_UPLOAD_MAX_FILE_COUNT:z.coerce.number().positive().default(10),

  // Eligibility Status Codes
  ELIGIBILITY_STATUS_CODE_ELIGIBLE: z.string().trim().min(1).default('775170000'),
  ELIGIBILITY_STATUS_CODE_INELIGIBLE: z.string().trim().min(1).default('775170001'),

  // Enrollment Status Codes
  ENROLLMENT_STATUS_CODE_ENROLLED: z.string().trim().min(1).default('775170000'),

  // Coverage Category Codes
  COVERAGE_CATEGORY_CODE_COPAY_TIER: z.string().trim().min(1).default('Co-Pay Tier'),
  COVERAGE_CATEGORY_CODE_COPAY_TIER_TPC: z.string().trim().min(1).default('Co-Pay Tier (TPC)'),

  // Coverage Tier Codes
  COVERAGE_TIER_CODE_TIER_1: z.string().trim().min(1).default('4f763da3-311c-ee11-8f6d-000d3a09d1b8'),
  COVERAGE_TIER_CODE_TIER_2: z.string().trim().min(1).default('f2f62bcb-311c-ee11-8f6d-000d3a09d1b8'),
  COVERAGE_TIER_CODE_TIER_3: z.string().trim().min(1).default('5984caeb-311c-ee11-8f6d-000d3a09d1b8'),
});

export type ClientEnv = ReadonlyDeep<z.infer<typeof clientEnvSchema>>;

/**
 * A utility function that returns environment variables:
 *
 *   - from the global window object when called from a client-side browser
 *   - from process.env when called from a server-side component
 *
 * For this to work in the browser, all publicly-accessible configuration
 * strings must be placed in the window.env object. In CDCP, this is done
 * through the <ClientEnv> react component.
 *
 * @see ~/components/client-env.tsx
 */
export function getClientEnv(): ClientEnv {
  const isServer = typeof document === 'undefined';

  if (!isServer) {
    return window.env;
  }

  const result = clientEnvSchema.safeParse(process.env);

  if (!result.success) {
    throw new Error(`Invalid application configuration: ${result.error}`);
  }

  return result.data;
}
