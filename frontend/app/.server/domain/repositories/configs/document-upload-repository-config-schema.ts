import { Result } from 'effect';
import * as z from 'zod';

import { validateOAuthIssuer } from '~/.server/utils/url-utils';
import { endpointPathname, stringToRedacted } from '~/.server/utils/zod-utils';

const documentUploadRepositoryMockConfigSchema = z.object({
  INTEROP_DOCUMENT_UPLOAD_PROVIDER: z.literal('mock'),
});

const documentUploadRepositoryDefaultConfigSchema = z.object({
  INTEROP_DOCUMENT_UPLOAD_PROVIDER: z.literal('default').default('default'),
  INTEROP_DOCUMENT_UPLOAD_BASE_URI: z.url().optional(),
  INTEROP_DOCUMENT_UPLOAD_SPO_UPLOAD_DOCUMENT_PATHNAME: endpointPathname('/client-correspondence/document-upload/upload/v1/api/SPOUploadDocument'),
  INTEROP_DOCUMENT_UPLOAD_SCAN_PATHNAME: endpointPathname('/client-correspondence/document-upload/upload/v1/api/Scan'),
  INTEROP_DOCUMENT_UPLOAD_OAUTH_CLIENT_ID: z.string().trim().nonempty().pipe(stringToRedacted),
  INTEROP_DOCUMENT_UPLOAD_OAUTH_CLIENT_SECRET: z
    .string()
    .refine((val) => val.trim().length > 0, { error: 'OAuth client secret must not be blank' })
    .pipe(stringToRedacted),
  INTEROP_DOCUMENT_UPLOAD_OAUTH_ISSUER: z
    .string()
    .trim()
    .refine((val) => Result.isSuccess(validateOAuthIssuer(val)), { error: 'Invalid OAuth issuer URL' }),
  INTEROP_DOCUMENT_UPLOAD_OAUTH_SCOPE: z.string().trim().nonempty(),
  INTEROP_DOCUMENT_UPLOAD_SUBSCRIPTION_KEY: z.string().trim().nonempty().pipe(stringToRedacted).optional(),

  /** Enterprise Wide Document Upload (EWDU) program activity ID */
  EWDU_PROGRAM_ACTIVITY_ID: z.string().default('CDCP'),

  /** Enterprise Wide Document Upload (EWDU) encapsulation username */
  EWDU_ENCAPSULATION_USERNAME: z.string().default('CDCP'),

  /** Enterprise Wide Document Upload (EWDU) encapsulation password */
  EWDU_ENCAPSULATION_PASSWORD: z.string().pipe(stringToRedacted),
});

export const documentUploadRepositoryConfigSchema = z.discriminatedUnion('INTEROP_DOCUMENT_UPLOAD_PROVIDER', [documentUploadRepositoryMockConfigSchema, documentUploadRepositoryDefaultConfigSchema]);

export type DocumentUploadRepositoryConfig = z.infer<typeof documentUploadRepositoryConfigSchema>;
