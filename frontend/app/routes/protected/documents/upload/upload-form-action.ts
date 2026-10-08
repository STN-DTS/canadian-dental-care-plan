/** Action values shared by upload form submissions and their client/server handlers. */
export const FORM_ACTION = {
  upload: 'upload',
  addFiles: 'add-files',
  finish: 'finish',
} as const;

/** A supported document upload form action value. */
export type FormAction = (typeof FORM_ACTION)[keyof typeof FORM_ACTION];
