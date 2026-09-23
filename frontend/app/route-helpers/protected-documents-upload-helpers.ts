import type { TFunction } from 'i18next';
import * as z from 'zod';

import { expectDefined } from '~/utils/assert-utils';
import { getClientEnv } from '~/utils/env-utils';
import { getFileExtension, hashFileBuffer } from '~/utils/file-utils';
import { bytesToFilesize, megabytesToBytes } from '~/utils/units-utils';

type DocumentUploadSchema = ReturnType<typeof createDocumentUploadSchema>;
export type DocumentUploadSchemaOutput = z.output<DocumentUploadSchema>;
export type DocumentUploadSchemaErrorTree = z.core.$ZodErrorTree<DocumentUploadSchemaOutput>;

type ValidateFileSelectionArgs = {
  formData: FormData;
  locale: string;
  t: TFunction<'documents', undefined>;
};

type ValidateFileSelectionSuccess = { success: true; validationId: string; errors: undefined };
type ValidateFileSelectionFailure = { success: false; validationId: string; errors: DocumentUploadSchemaErrorTree };
type ValidateFileSelectionResult = ValidateFileSelectionSuccess | ValidateFileSelectionFailure;

/**
 * Validates newly selected files against upload count, extension, and size limits.
 *
 * @param args - Form data, locale, and translator used for validation.
 * @returns Validation ID and file selection errors, when present.
 */
export function validateFileSelection({ formData, locale, t }: ValidateFileSelectionArgs): ValidateFileSelectionResult {
  const validationId = z.string().parse(formData.get('_validation_id'));
  const incomingFiles = formData.getAll('file_object') as File[];
  const fileSelectionSchema = createFileSelectionSchema({ locale, t });

  const validationResult = fileSelectionSchema.safeParse({
    currentFileCount: formData.get('current_file_count'),
    files: incomingFiles,
  });

  if (!validationResult.success) {
    const errorMessage = expectDefined(validationResult.error.issues[0], 'Expected file selection validation issue').message;
    return {
      success: false,
      validationId,
      errors: {
        errors: [],
        properties: {
          files: {
            errors: [errorMessage],
          },
        },
      },
    };
  }

  return {
    success: true,
    validationId,
    errors: undefined,
  };
}

type ValidateUploadFormArgs = {
  formData: FormData;
  locale: string;
  t: TFunction<'documents'>;
};

type ValidateUploadFormSuccess = { success: true; data: DocumentUploadSchemaOutput };
type ValidateUploadFormFailure = { success: false; errors: DocumentUploadSchemaErrorTree };
type ValidateUploadFormResult = ValidateUploadFormSuccess | ValidateUploadFormFailure;

/**
 * Reads and validates documents submitted for upload.
 *
 * @param args - Form data, locale, and translator used for validation.
 * @returns Validated document data on success; otherwise, structured validation errors.
 * @throws {Error} When a file ID has no corresponding file object.
 */
export async function validateUploadForm({ formData, locale, t }: ValidateUploadFormArgs): Promise<ValidateUploadFormResult> {
  const schema = createDocumentUploadSchema({ locale, t });
  const fileIds = formData.getAll('file_id') as string[];
  const fileObjects = formData.getAll('file_object') as File[];
  const documentTypes = formData.getAll('file_document_type') as string[];

  const files: Record<string, { file: File; fileBuffer: ArrayBuffer; fileHash: string; documentType: string }> = Object.fromEntries(
    await Promise.all(
      fileIds.map(async (fileId, index) => {
        const file = expectDefined(fileObjects[index], 'Expected file object at index ' + index);
        const fileBuffer = await file.arrayBuffer();
        const fileHash = await hashFileBuffer(fileBuffer);
        const documentType = documentTypes[index] ?? '';
        return [fileId, { file, fileBuffer, fileHash, documentType }] as const;
      }),
    ),
  );

  const result = schema.safeParse({ files });

  if (!result.success) {
    return {
      success: false,
      errors: z.treeifyError(result.error),
    };
  }

  return {
    success: true,
    data: result.data,
  };
}

type CreateFileSelectionSchemaArgs = {
  locale: string;
  t: TFunction<'documents'>;
};

/**
 * Creates schema for validating newly selected files against client upload limits.
 *
 * @param args - Locale and translator used to produce localized validation errors.
 * @returns Schema that validates current file count and selected files.
 */
function createFileSelectionSchema({ locale, t }: CreateFileSelectionSchemaArgs) {
  const { DOCUMENT_UPLOAD_MAX_FILE_COUNT } = getClientEnv();
  const fileSchema = createFileValidationSchema({ locale, t });

  return z
    .object({
      currentFileCount: z.coerce.number().int().nonnegative().readonly(),
      files: z.array(z.custom<File>((value) => typeof value === 'object' && value !== null && 'name' in value && 'size' in value)).readonly(),
    })
    .superRefine(({ currentFileCount, files }, ctx) => {
      if (currentFileCount + files.length > DOCUMENT_UPLOAD_MAX_FILE_COUNT) {
        ctx.addIssue({ code: 'custom', message: t(($) => $.upload.errorMessage.tooManyFiles, { count: DOCUMENT_UPLOAD_MAX_FILE_COUNT }), path: ['files'] });
        return;
      }

      for (const file of files) {
        const issue = fileSchema.safeParse(file).error?.issues[0];
        if (issue) {
          ctx.addIssue({ code: 'custom', message: issue.message, path: ['files'] });
          return;
        }
      }
    });
}

type CreateFileValidationSchemaArgs = {
  locale: string;
  t: TFunction<'documents'>;
};

/**
 * Creates schema for validating file extension and size.
 *
 * @param args - Locale and translator used to produce localized validation errors.
 * @returns Schema configured with client upload extension and size limits.
 */
function createFileValidationSchema({ locale, t }: CreateFileValidationSchemaArgs) {
  const { DOCUMENT_UPLOAD_ALLOWED_FILE_EXTENSIONS, DOCUMENT_UPLOAD_MAX_FILE_SIZE_MB } = getClientEnv();
  const maxFileSizeInBytes = megabytesToBytes(DOCUMENT_UPLOAD_MAX_FILE_SIZE_MB);
  return z
    .custom<File>((value) => typeof value === 'object' && value !== null && 'name' in value && 'size' in value)
    .superRefine((file, ctx) => {
      if (!DOCUMENT_UPLOAD_ALLOWED_FILE_EXTENSIONS.includes(getFileExtension(file.name))) {
        ctx.addIssue({
          code: 'custom',
          message: t(($) => $.upload.errorMessage.invalidFileType, { filename: file.name, extensions: DOCUMENT_UPLOAD_ALLOWED_FILE_EXTENSIONS.join(', ') }),
        });
      } else if (file.size > maxFileSizeInBytes) {
        ctx.addIssue({
          code: 'custom',
          message: t(($) => $.upload.errorMessage.fileTooLarge, { filename: file.name, filesize: bytesToFilesize(maxFileSizeInBytes, `${locale}-CA`) }),
        });
      }
    });
}

type CreateDocumentUploadSchemaArgs = {
  locale: string;
  t: TFunction<'documents'>;
};

/**
 * Creates schema for validating complete document upload data.
 *
 * @param args - Locale and translator used to produce localized validation errors.
 * @returns Schema that validates files, document types, and upload count.
 */
function createDocumentUploadSchema({ locale, t }: CreateDocumentUploadSchemaArgs) {
  const { DOCUMENT_UPLOAD_MAX_FILE_COUNT } = getClientEnv();
  const fileValidationSchema = createFileValidationSchema({ locale, t });
  const fileSchema = z
    .object({
      file: z.instanceof(File),
      fileBuffer: z.instanceof(ArrayBuffer),
      fileHash: z.string(),
      documentType: z.string(),
    })
    .superRefine((data, ctx) => {
      const fileIssue = fileValidationSchema.safeParse(data.file).error?.issues[0];
      if (fileIssue) {
        ctx.addIssue({ code: 'custom', message: fileIssue.message, path: ['file'] });
      } else if (!data.documentType) {
        ctx.addIssue({ code: 'custom', message: t(($) => $.upload.errorMessage.documentTypeRequired, { filename: data.file.name }), path: ['documentType'] });
      }
    });

  return z.object({
    files: z
      .record(z.string(), fileSchema)
      .refine(
        (value) => Object.keys(value).length > 0,
        t(($) => $.upload.errorMessage.fileRequired),
      )
      .refine(
        (value) => Object.keys(value).length <= DOCUMENT_UPLOAD_MAX_FILE_COUNT,
        t(($) => $.upload.errorMessage.tooManyFiles, { count: DOCUMENT_UPLOAD_MAX_FILE_COUNT }),
      ),
  });
}
