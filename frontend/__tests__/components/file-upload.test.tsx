import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

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

async function dispatchAndSettle(dispatch: () => void) {
  await act(async () => {
    dispatch();
    await Promise.resolve();
  });
}

function renderFileUpload(onBeforeFilesAdd?: (files: ReadonlyArray<File>) => boolean | void | Promise<boolean | void>) {
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
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('uses the provided description ID for the file input', () => {
    render(
      <FileUpload label="Documents" descriptionId="file-upload-help" value={[]} onValueChange={vi.fn()}>
        <p id="file-upload-help">Choose a supported document.</p>
      </FileUpload>,
    );

    expect(screen.getByLabelText('Documents')).toHaveAccessibleDescription('Choose a supported document.');
  });

  it('does not reference a dropzone when no description ID is provided', () => {
    render(<FileUpload label="Documents" value={[]} onValueChange={vi.fn()} />);

    expect(screen.getByLabelText('Documents')).not.toHaveAttribute('aria-describedby');
  });

  it('keeps the native input exposed when a dropzone provides the interaction', () => {
    const { input } = renderFileUpload();

    expect(input).not.toHaveAttribute('aria-hidden');
  });

  it('exposes the visible trigger instead of the hidden native input', () => {
    const { container } = render(
      <FileUpload label="Upload document" hideInputFromAccessibility value={[]} onValueChange={vi.fn()}>
        <FileUploadTrigger asChild>
          <button type="button">Upload file</button>
        </FileUploadTrigger>
      </FileUpload>,
    );

    expect(container.querySelector('input[type="file"]')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByRole('button', { name: 'Upload file' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Upload document' })).not.toBeInTheDocument();
  });

  it('opens the file picker when the visible trigger is activated by keyboard', async () => {
    const { container } = render(
      <FileUpload label="Upload document" hideInputFromAccessibility value={[]} onValueChange={vi.fn()}>
        <FileUploadTrigger asChild>
          <button type="button">Upload file</button>
        </FileUploadTrigger>
      </FileUpload>,
    );
    const input = container.querySelector<HTMLInputElement>('input[type="file"]');

    if (!input) {
      throw new Error('Expected the hidden native file input');
    }

    const inputClick = vi.spyOn(input, 'click');
    const user = userEvent.setup();
    const trigger = screen.getByRole('button', { name: 'Upload file' });

    await user.tab();
    expect(trigger).toHaveFocus();

    await user.keyboard('{Enter}');
    expect(inputClick).toHaveBeenCalledOnce();
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
    expect(screen.getByRole('list').tagName).toBe('UL');
    expect(screen.getByRole('listitem', { name: 'document.pdf' }).tagName).toBe('LI');
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

  it.each([
    { name: 'false', onBeforeFilesAdd: () => false },
    { name: 'a promise of false', onBeforeFilesAdd: async () => await Promise.resolve(false) },
  ])('rejects files when pre-add validation returns $name', async ({ onBeforeFilesAdd }) => {
    const file = new File(['contents'], 'document.pdf', { type: 'application/pdf' });
    const onBeforeFilesAddMock = vi.fn(onBeforeFilesAdd);
    const { input, onValueChange } = renderFileUpload(onBeforeFilesAddMock);

    await dispatchAndSettle(() => fireEvent.change(input, { target: { files: [file] } }));

    expect(onBeforeFilesAddMock).toHaveBeenCalledWith([file]);
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it.each([
    { name: 'true', onBeforeFilesAdd: () => true },
    { name: 'a promise of true', onBeforeFilesAdd: async () => await Promise.resolve(true) },
    { name: 'nothing', onBeforeFilesAdd: () => {} },
  ])('adds files once when pre-add validation returns $name', async ({ onBeforeFilesAdd }) => {
    const file = new File(['contents'], 'document.pdf', { type: 'application/pdf' });
    const onBeforeFilesAddMock = vi.fn(onBeforeFilesAdd);
    const { input, onValueChange } = renderFileUpload(onBeforeFilesAddMock);

    fireEvent.change(input, { target: { files: [file] } });

    expect(onBeforeFilesAddMock).toHaveBeenCalledWith([file]);
    await waitFor(() => expect(onValueChange).toHaveBeenCalledWith([expect.objectContaining({ file })]));
    expect(onValueChange).toHaveBeenCalledOnce();
  });

  it('does not add files until asynchronous pre-add validation resolves', async () => {
    const file = new File(['contents'], 'document.pdf', { type: 'application/pdf' });

    let resolveValidation: (accepted: boolean) => void = () => {};

    const validation = new Promise<boolean>((resolve) => {
      resolveValidation = resolve;
    });
    const { input, onValueChange } = renderFileUpload(async () => await validation);

    await dispatchAndSettle(() => fireEvent.change(input, { target: { files: [file] } }));
    expect(onValueChange).not.toHaveBeenCalled();

    await dispatchAndSettle(() => resolveValidation(true));
    expect(onValueChange).toHaveBeenCalledWith([expect.objectContaining({ file })]);
  });

  it('logs a rejected pre-add validation and does not add files', async () => {
    const file = new File(['contents'], 'document.pdf', { type: 'application/pdf' });
    const error = new Error('Validation failed');
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { input, onValueChange } = renderFileUpload(async () => await Promise.reject(error));

    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => expect(consoleError).toHaveBeenCalledWith('File upload pre-add validation failed.', error));
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it('validates dropped files before adding them', async () => {
    const file = new File(['contents'], 'document.pdf', { type: 'application/pdf' });
    stubDataTransfer();
    const onBeforeFilesAdd = vi.fn(() => false);
    const { input, dropzone, onValueChange } = renderFileUpload(onBeforeFilesAdd);
    allowFileAssignment(input);

    await dispatchAndSettle(() => fireEvent.drop(dropzone, { dataTransfer: { files: [file] } }));

    expect(onBeforeFilesAdd).toHaveBeenCalledWith([file]);
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it('validates pasted files before adding them', async () => {
    const file = new File(['contents'], 'document.pdf', { type: 'application/pdf' });
    stubDataTransfer();
    const onBeforeFilesAdd = vi.fn(() => false);
    const { input, dropzone, onValueChange } = renderFileUpload(onBeforeFilesAdd);
    allowFileAssignment(input);

    await dispatchAndSettle(() => fireEvent.paste(dropzone, { clipboardData: { items: [{ kind: 'file', getAsFile: () => file }] } }));

    expect(onBeforeFilesAdd).toHaveBeenCalledWith([file]);
    expect(onValueChange).not.toHaveBeenCalled();
  });
});
