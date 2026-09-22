import { fireEvent, render, screen } from '@testing-library/react';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { FileUpload, FileUploadDropzone } from '~/components/file-upload';

function stubDataTransfer() {
  vi.stubGlobal(
    'DataTransfer',
    class {
      private readonly addedFiles: File[] = [];
      readonly items = { add: (file: File) => this.addedFiles.push(file) };

      get files() {
        return this.addedFiles;
      }
    },
  );
}

function allowFileAssignment(input: HTMLElement) {
  Object.defineProperty(input, 'files', { configurable: true, writable: true, value: [] });
}

function renderFileUpload(onBeforeFilesAdd?: (files: ReadonlyArray<File>) => boolean) {
  const onValueChange = vi.fn();

  render(
    <FileUpload label="Documents" value={[]} onValueChange={onValueChange} onBeforeFilesAdd={onBeforeFilesAdd} multiple>
      <FileUploadDropzone data-testid="dropzone" />
    </FileUpload>,
  );

  return {
    input: screen.getByLabelText('Documents'),
    dropzone: screen.getByTestId('dropzone'),
    onValueChange,
  };
}

describe('FileUpload', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('rejects files before changing the value', () => {
    const file = new File(['contents'], 'document.pdf', { type: 'application/pdf' });
    const onBeforeFilesAdd = vi.fn(() => false);
    const { input, onValueChange } = renderFileUpload(onBeforeFilesAdd);

    fireEvent.change(input, { target: { files: [file] } });

    expect(onBeforeFilesAdd).toHaveBeenCalledWith([file]);
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it('adds files when pre-add validation succeeds', () => {
    const file = new File(['contents'], 'document.pdf', { type: 'application/pdf' });
    const onBeforeFilesAdd = vi.fn(() => true);
    const { input, onValueChange } = renderFileUpload(onBeforeFilesAdd);

    fireEvent.change(input, { target: { files: [file] } });

    expect(onBeforeFilesAdd).toHaveBeenCalledWith([file]);
    expect(onValueChange).toHaveBeenCalledWith([expect.objectContaining({ file })]);
  });

  it('validates dropped files before adding them', () => {
    const file = new File(['contents'], 'document.pdf', { type: 'application/pdf' });
    stubDataTransfer();
    const onBeforeFilesAdd = vi.fn(() => false);
    const { input, dropzone, onValueChange } = renderFileUpload(onBeforeFilesAdd);
    allowFileAssignment(input);

    fireEvent.drop(dropzone, { dataTransfer: { files: [file] } });

    expect(onBeforeFilesAdd).toHaveBeenCalledWith([file]);
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it('validates pasted files before adding them', () => {
    const file = new File(['contents'], 'document.pdf', { type: 'application/pdf' });
    stubDataTransfer();
    const onBeforeFilesAdd = vi.fn(() => false);
    const { input, dropzone, onValueChange } = renderFileUpload(onBeforeFilesAdd);
    allowFileAssignment(input);

    fireEvent.paste(dropzone, {
      clipboardData: {
        items: [{ kind: 'file', getAsFile: () => file }],
      },
    });

    expect(onBeforeFilesAdd).toHaveBeenCalledWith([file]);
    expect(onValueChange).not.toHaveBeenCalled();
  });
});
