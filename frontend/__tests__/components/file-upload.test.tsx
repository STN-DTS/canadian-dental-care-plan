import { fireEvent, render, screen } from '@testing-library/react';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { FileUpload, FileUploadDropzone, FileUploadItem, FileUploadItemDelete, FileUploadList, FileUploadTrigger } from '~/components/file-upload';

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

  it('links removal to the rendered item without assigning list orientation', () => {
    const file = new File(['contents'], 'document.pdf', { type: 'application/pdf' });

    render(
      <FileUpload label="Documents" value={[{ id: 'document', file }]} onValueChange={vi.fn()}>
        <FileUploadList>
          <FileUploadItem id="file-upload-item-document" aria-labelledby="file-upload-item-document-name" aria-describedby={undefined} value="document">
            <span id="file-upload-item-document-name">document.pdf</span>
            <FileUploadItemDelete asChild aria-describedby="file-upload-item-document-name">
              <button type="button">Remove file</button>
            </FileUploadItemDelete>
          </FileUploadItem>
        </FileUploadList>
      </FileUpload>,
    );

    expect(screen.getByRole('list')).not.toHaveAttribute('aria-orientation');
    expect(screen.getByRole('button', { name: 'Remove file' })).toHaveAttribute('aria-controls', 'file-upload-item-document');
    expect(screen.getByRole('listitem', { name: 'document.pdf' })).not.toHaveAttribute('aria-describedby');
    expect(screen.getByRole('button', { name: 'Remove file' })).toHaveAccessibleDescription('document.pdf');
  });

  it('keeps removal enabled when only the add trigger is disabled', () => {
    const file = new File(['contents'], 'document.pdf', { type: 'application/pdf' });
    const onValueChange = vi.fn();

    render(
      <FileUpload label="Documents" value={[{ id: 'document', file }]} onValueChange={onValueChange}>
        <FileUploadTrigger disabled>Upload file</FileUploadTrigger>
        <FileUploadItem value="document">
          <FileUploadItemDelete>Remove</FileUploadItemDelete>
        </FileUploadItem>
      </FileUpload>,
    );

    expect(screen.getByRole('button', { name: 'Upload file' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Remove' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    expect(onValueChange).toHaveBeenCalledWith([]);
  });

  it('rejects files before changing the value', () => {
    const file = new File(['contents'], 'document.pdf', { type: 'application/pdf' });
    const onBeforeFilesAdd = vi.fn(() => false);
    const { input, onValueChange } = renderFileUpload(onBeforeFilesAdd);

    fireEvent.change(input, { target: { files: [file] } });

    expect(onBeforeFilesAdd).toHaveBeenCalledWith([file]);
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it('adds files once when pre-add validation succeeds', () => {
    const file = new File(['contents'], 'document.pdf', { type: 'application/pdf' });
    const onBeforeFilesAdd = vi.fn(() => true);
    const { input, onValueChange } = renderFileUpload(onBeforeFilesAdd);

    fireEvent.change(input, { target: { files: [file] } });

    expect(onBeforeFilesAdd).toHaveBeenCalledWith([file]);
    expect(onValueChange).toHaveBeenCalledWith([expect.objectContaining({ file })]);
    expect(onValueChange).toHaveBeenCalledTimes(1);
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
