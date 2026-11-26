import type { TFunction } from 'i18next';
import type { Get } from 'type-fest';
import * as z from 'zod';

import { expectDefined } from '~/utils/assert-utils';
import { getClientEnv } from '~/utils/env-utils';
import type { DocumentUploadAllowedFileType } from '~/utils/env-utils';
import { findDuplicateFile, getFileExtension, hashFileBuffer, isFileContentTypeAllowed } from '~/utils/file-utils';
import { bytesToFilesize, megabytesToBytes } from '~/utils/units-utils';

type DocumentUploadSchema = ReturnType<typeof createDocumentUploadSchema>;
export type DocumentUploadSchemaOutput = z.output<DocumentUploadSchema>;
export type DocumentUploadSchemaErrorTree = z.core.$ZodErrorTree<DocumentUploadSchemaOutput>;

export type FileContentValidationFailureReason = 'unsupported_file_extension' | 'unsupported_file_content_type' | 'file_content_validation_failed';

type FileValidationContext = 'fileSelection' | 'submit';

type ValidateFileContentArgs = {
  allowedExtensions: readonly string[];
  allowedFileTypesByExtension: ReadonlyMap<string, DocumentUploadAllowedFileType>;
  context: FileValidationContext;
  file: File;
  locale: string;
  t: TFunction<'documents'>;
};

type ValidateFileContentResult = { success: true; error?: undefined; reason?: undefined } | { success: false; error: string; reason: FileContentValidationFailureReason; cause?: unknown };

type ValidateFileSelectionArgs = {
  currentFileCount: number;
  existingFiles: ReadonlyArray<File>;
  files: ReadonlyArray<File>;
  locale: string;
  t: TFunction<'documents', undefined>;
};

type ValidateFileSelectionSuccess = { success: true; errors: undefined };
type ValidateFileSelectionFailure = { success: false; errors: DocumentUploadSchemaErrorTree };
type ValidateFileSelectionResult = ValidateFileSelectionSuccess | ValidateFileSelectionFailure;

/**
 * Validates newly selected files against upload count, extension, size, content type, and duplicate limits.
 *
 * @param args - Current file count, already listed files, proposed files, locale, and translator.
 * @returns Whether the selection is valid and any file selection errors.
 */
export async function validateFileSelection({ currentFileCount, existingFiles, files, locale, t }: ValidateFileSelectionArgs): Promise<ValidateFileSelectionResult> {
  const fileSelectionSchema = createFileSelectionSchema({ locale, t });

  const validationResult = fileSelectionSchema.safeParse({
    currentFileCount,
    files,
  });

  let errorMessage: string | undefined;

  if (validationResult.success) {
    const { DOCUMENT_UPLOAD_ALLOWED_FILE_TYPES } = getClientEnv();
    const allowedFileTypesByExtension = new Map(DOCUMENT_UPLOAD_ALLOWED_FILE_TYPES.map((fileType) => [fileType.extension.toLowerCase(), fileType]));
    const allowedExtensions = [...allowedFileTypesByExtension.keys()];

    const contentResults = await Promise.all(
      files.map(
        async (file) =>
          await validateFileContent({
            allowedExtensions,
            allowedFileTypesByExtension,
            context: 'fileSelection',
            file,
            locale,
            t,
          }),
      ),
    );

    const firstContentFailure = contentResults.find((result) => !result.success);

    if (firstContentFailure) {
      errorMessage = firstContentFailure.error;
    } else {
      const duplicateFile = await findDuplicateFile([...existingFiles, ...files]);

      if (duplicateFile) {
        errorMessage = t(($) => $.upload.errorMessage.duplicateFile, { filename: duplicateFile.name });
      }
    }
  } else {
    errorMessage = expectDefined(validationResult.error.issues[0], 'Expected file selection validation issue').message;
  }

  if (errorMessage !== undefined) {
    return {
      success: false,
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
    errors: undefined,
  };
}

type ValidateUploadedFileContentsArgs = {
  allowedFileTypes?: ReadonlyArray<DocumentUploadAllowedFileType>;
  files: Readonly<Record<string, { file: File }>>;
  locale: string;
  onFailure?: (failure: { id: string; reason: FileContentValidationFailureReason; cause?: unknown }) => void;
  t: TFunction<'documents'>;
};

export type ValidateUploadedFileContentsResult = { success: true; errors?: undefined } | { success: false; errors: DocumentUploadSchemaErrorTree };

/**
 * Validates that each submitted file has a supported extension and content matching that extension's MIME type.
 *
 * Checks the file extension first before inspecting magic bytes. Shared between client and server upload actions.
 *
 * @param args - Files, locale, translator, optional allowed file types override, and optional failure callback.
 * @returns Success when every document passes content validation; otherwise, file-specific errors.
 */
export async function validateUploadedFileContents({ allowedFileTypes = getClientEnv().DOCUMENT_UPLOAD_ALLOWED_FILE_TYPES, files, locale, onFailure, t }: ValidateUploadedFileContentsArgs): Promise<ValidateUploadedFileContentsResult> {
  const allowedFileTypesByExtension = new Map(allowedFileTypes.map((fileType) => [fileType.extension.toLowerCase(), fileType]));
  const allowedExtensions = [...allowedFileTypesByExtension.keys()];

  const results = await Promise.all(
    Object.entries(files).map(async ([id, { file }]) => {
      const result = await validateFileContent({
        allowedExtensions,
        allowedFileTypesByExtension,
        context: 'submit',
        file,
        locale,
        t,
      });

      if (!result.success) {
        onFailure?.({ id, reason: result.reason, cause: result.cause });
        return { id, error: result.error };
      }

      return { id };
    }),
  );

  return createDocumentUploadFileErrorTree(results);
}

/**
 * Validates one file's extension against the allow-list first, then checks that its content matches that extension's MIME type.
 */
async function validateFileContent({ allowedExtensions, allowedFileTypesByExtension, context, file, locale, t }: ValidateFileContentArgs): Promise<ValidateFileContentResult> {
  const fileExtension = getFileExtension(file.name).toLowerCase();
  const allowedFileType = allowedFileTypesByExtension.get(fileExtension);

  if (!allowedFileType) {
    return {
      success: false,
      reason: 'unsupported_file_extension',
      error: t(($) => $.upload.errorMessage.invalidFileType, {
        context,
        filename: file.name,
        extensions: allowedExtensions.join(', '),
      }),
    };
  }

  try {
    const isContentTypeAllowed = await isFileContentTypeAllowed({
      allowedExtensions,
      file,
    });

    if (!isContentTypeAllowed) {
      const fileTypeName = locale.toLowerCase().startsWith('fr') ? allowedFileType.nameFr : allowedFileType.nameEn;
      return {
        success: false,
        reason: 'unsupported_file_content_type',
        error: t(($) => $.upload.errorMessage.invalidFileContent, {
          context,
          filename: file.name,
          fileTypeName,
          fileExtension: allowedFileType.extension,
        }),
      };
    }

    return { success: true };
  } catch (cause) {
    return {
      success: false,
      reason: 'file_content_validation_failed',
      cause,
      error: t(($) => $.upload.errorMessage.contentValidationError, { filename: file.name }),
    };
  }
}

/**
 * Converts per-file batch failures into a structured document upload error tree keyed by file ID.
 *
 * @param results - Per-file operation results identified by file ID.
 * @returns Success when no result contains an error; otherwise, an error tree keyed by file ID.
 */
export function createDocumentUploadFileErrorTree(results: ReadonlyArray<{ id: string; error?: string }>): ValidateUploadedFileContentsResult {
  const failures = results.filter((result): result is { id: string; error: string } => result.error !== undefined);

  if (failures.length === 0) {
    return { success: true };
  }

  const fileProperties: NonNullable<Get<DocumentUploadSchemaErrorTree, 'properties.files.properties'>> = {};

  for (const { id, error } of failures) {
    fileProperties[id] = {
      errors: [],
      properties: {
        file: {
          errors: [error],
        },
      },
    };
  }

  return {
    success: false,
    errors: {
      errors: [],
      properties: {
        files: {
          errors: [],
          properties: fileProperties,
        },
      },
    },
  };
}

type FileRecord = {
  file: File;
  fileBuffer: ArrayBuffer;
  fileHash: string;
  documentType: string;
};

/**
 * Reads submitted file bytes and hashes them, pairing each file ID with its document type.
 * @param formData - The multipart fields containing file IDs, file objects, and document types.
 * @returns Parsed file records keyed by their submitted IDs.
 * @throws If a file ID has no corresponding file object or reading its bytes fails.
 */
export async function getFiles(formData: FormData): Promise<ReadonlyMap<string, FileRecord>> {
  const fileIds = formData.getAll('file_id') as string[];
  const fileObjects = formData.getAll('file_object') as File[];
  const documentTypes = formData.getAll('file_document_type') as string[];

  return new Map(
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
}

type ValidateUploadedFilesArgs = {
  files: ReadonlyMap<string, FileRecord>;
  locale: string;
  t: TFunction<'documents'>;
};

type ValidateUploadedFilesSuccess = { success: true; data: DocumentUploadSchemaOutput };
type ValidateUploadedFilesFailure = { success: false; errors: DocumentUploadSchemaErrorTree };
type ValidateUploadedFilesResult = ValidateUploadedFilesSuccess | ValidateUploadedFilesFailure;

/**
 * Validates already parsed files without reading or hashing their contents again.
 *
 * @param args - Files, locale, and translator used for validation.
 * @returns Validated document data on success; otherwise, structured validation errors.
 */
export function validateUploadedFiles({ files, locale, t }: ValidateUploadedFilesArgs): ValidateUploadedFilesResult {
  const schema = createDocumentUploadSchema({ locale, t });
  const result = schema.safeParse({ files: Object.fromEntries(files) });

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
  const fileSchema = createFileValidationSchema({ locale, t, context: 'fileSelection' });

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
  context: FileValidationContext;
  locale: string;
  t: TFunction<'documents'>;
};

/**
 * Creates schema for validating file extension and size.
 *
 * @param args - Locale and translator used to produce localized validation errors.
 * @returns Schema configured with client upload extension and size limits.
 */
function createFileValidationSchema({ context, locale, t }: CreateFileValidationSchemaArgs) {
  const { DOCUMENT_UPLOAD_ALLOWED_FILE_TYPES, DOCUMENT_UPLOAD_MAX_FILE_SIZE_MB } = getClientEnv();
  const allowedExtensions = DOCUMENT_UPLOAD_ALLOWED_FILE_TYPES.map(({ extension }) => extension.toLowerCase());
  const maxFileSizeInBytes = megabytesToBytes(DOCUMENT_UPLOAD_MAX_FILE_SIZE_MB);
  return z
    .custom<File>((value) => typeof value === 'object' && value !== null && 'name' in value && 'size' in value)
    .superRefine((file, ctx) => {
      if (!allowedExtensions.includes(getFileExtension(file.name).toLowerCase())) {
        ctx.addIssue({
          code: 'custom',
          message: t(($) => $.upload.errorMessage.invalidFileType, {
            context,
            filename: file.name,
            extensions: allowedExtensions.join(', '),
          }),
        });
      } else if (file.size > maxFileSizeInBytes) {
        ctx.addIssue({
          code: 'custom',
          message: t(($) => $.upload.errorMessage.fileTooLarge, {
            context,
            filename: file.name,
            filesize: bytesToFilesize(maxFileSizeInBytes, `${locale}-CA`),
          }),
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
  const fileValidationSchema = createFileValidationSchema({ locale, t, context: 'submit' });
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
      )
      .superRefine((files, ctx) => {
        const seenFiles = new Set<string>();

        for (const [id, { file, fileHash }] of Object.entries(files)) {
          const fileKey = JSON.stringify([file.name, file.size, fileHash]);

          if (seenFiles.has(fileKey)) {
            ctx.addIssue({ code: 'custom', message: t(($) => $.upload.errorMessage.duplicateFile, { filename: file.name }), path: [id, 'file'] });
          } else {
            seenFiles.add(fileKey);
          }
        }
      }),
  });
}
