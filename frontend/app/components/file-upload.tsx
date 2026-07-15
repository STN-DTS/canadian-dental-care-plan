import { createContext, use, useCallback, useEffect, useId, useMemo, useRef, useSyncExternalStore } from 'react';
import type { ChangeEvent, ClipboardEvent, ComponentProps, DragEvent, KeyboardEvent, MouseEvent, ReactNode, RefObject } from 'react';

import { faFile, faFileArchive, faFileAudio, faFileCode, faFileImage, faFileText, faFileVideo, faGear } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Slot } from '@radix-ui/react-slot';

import { cn } from '~/utils/tw-utils';

const ROOT_NAME = 'FileUpload';
const DROPZONE_NAME = 'FileUploadDropzone';
const TRIGGER_NAME = 'FileUploadTrigger';
const LIST_NAME = 'FileUploadList';
const ITEM_NAME = 'FileUploadItem';
const ITEM_PREVIEW_NAME = 'FileUploadItemPreview';
const ITEM_METADATA_NAME = 'FileUploadItemMetadata';
const ITEM_DELETE_NAME = 'FileUploadItemDelete';
const CLEAR_NAME = 'FileUploadClear';

function useLazyRef<T>(fn: () => T) {
  const ref = useRef<T | null>(null);
  ref.current ??= fn();
  return ref as RefObject<T>;
}

type Direction = 'ltr' | 'rtl';

const DirectionContext = createContext<Direction | undefined>(undefined);

function useDirection(dirProp?: Direction): Direction {
  const contextDir = use(DirectionContext);
  return dirProp ?? contextDir ?? 'ltr';
}

export interface FileState {
  /** Unique identifier for the file */
  readonly id: string;
  /** The actual File object */
  readonly file: File;
}

interface StoreState {
  files: Map<string, File>;
  dragOver: boolean;
  invalid: boolean;
}

type StoreAction =
  | { type: 'ADD_FILES'; files: ReadonlyArray<File> } //
  | { type: 'SET_FILES'; files: ReadonlyArray<FileState> }
  | { type: 'REMOVE_FILE'; id: string }
  | { type: 'SET_DRAG_OVER'; dragOver: boolean }
  | { type: 'SET_INVALID'; invalid: boolean }
  | { type: 'CLEAR' };

function createStore(listeners: Set<() => void>, files: Map<string, File>, invalid: boolean, onValueChange: (files: ReadonlyArray<FileState>) => void) {
  let state: StoreState = {
    files,
    dragOver: false,
    invalid: invalid,
  };

  function reducer(state: StoreState, action: StoreAction): StoreState {
    switch (action.type) {
      case 'ADD_FILES': {
        for (const file of action.files) {
          files.set(crypto.randomUUID(), file);
        }

        const fileList = [...files].map(([id, file]) => ({ id, file }));
        onValueChange(fileList);
        return { ...state, files };
      }

      case 'SET_FILES': {
        const newFileSet = new Map(action.files.map((f) => [f.id, f.file]));
        for (const existingFile of files.keys()) {
          if (!newFileSet.has(existingFile)) {
            files.delete(existingFile);
          }
        }

        for (const file of action.files) {
          const existingState = files.get(file.id);
          if (!existingState) {
            files.set(file.id, file.file);
          }
        }
        return { ...state, files };
      }

      case 'REMOVE_FILE': {
        files.delete(action.id);

        const fileList = [...files].map(([id, file]) => ({ id, file }));
        onValueChange(fileList);
        return { ...state, files };
      }

      case 'SET_DRAG_OVER': {
        return { ...state, dragOver: action.dragOver };
      }

      case 'SET_INVALID': {
        return { ...state, invalid: action.invalid };
      }

      case 'CLEAR': {
        files.clear();
        onValueChange([]);
        return { ...state, files, invalid: false };
      }

      default: {
        return state;
      }
    }
  }

  function getState() {
    return state;
  }

  function dispatch(action: StoreAction) {
    state = reducer(state, action);
    for (const listener of listeners) {
      listener();
    }
  }

  function subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  return { getState, dispatch, subscribe };
}

const StoreContext = createContext<ReturnType<typeof createStore> | null>(null);

function useStoreContext(consumerName: string) {
  const context = use(StoreContext);
  if (!context) {
    throw new Error(`\`${consumerName}\` must be used within \`${ROOT_NAME}\``);
  }
  return context;
}

function useStore<T>(selector: (state: StoreState) => T): T {
  const store = useStoreContext('useStore');

  const lastValueRef = useLazyRef<{ value: T; state: StoreState } | null>(() => null);

  const getSnapshot = useCallback(() => {
    const state = store.getState();
    const prevValue = lastValueRef.current;

    if (prevValue?.state === state) {
      return prevValue.value;
    }

    const nextValue = selector(state);
    lastValueRef.current = { value: nextValue, state };
    return nextValue;
  }, [store, selector, lastValueRef]);

  return useSyncExternalStore(store.subscribe, getSnapshot, getSnapshot);
}

interface FileUploadContextValue {
  inputId: string;
  dropzoneId: string;
  listId: string;
  labelId: string;
  disabled: boolean;
  dir: Direction;
  inputRef: RefObject<HTMLInputElement | null>;
}

const FileUploadContext = createContext<FileUploadContextValue | null>(null);

function useFileUploadContext(consumerName: string) {
  const context = use(FileUploadContext);
  if (!context) {
    throw new Error(`\`${consumerName}\` must be used within \`${ROOT_NAME}\``);
  }
  return context;
}

interface FileUploadRootProps extends Omit<ComponentProps<'div'>, 'defaultValue' | 'onChange'> {
  value: FileState[];
  onValueChange: (files: ReadonlyArray<FileState>) => void;
  accept?: string;
  dir?: Direction;
  label?: string;
  name?: string;
  asChild?: boolean;
  disabled?: boolean;
  invalid?: boolean;
  multiple?: boolean;
  required?: boolean;
}

function FileUploadRoot(props: FileUploadRootProps) {
  const { value, onValueChange, accept, dir: dirProp, label, name, asChild, disabled = false, invalid = false, multiple = false, required = false, children, className, ...rootProps } = props;

  const inputId = useId();
  const dropzoneId = useId();
  const listId = useId();
  const labelId = useId();

  const dir = useDirection(dirProp);
  const listeners = useLazyRef(() => new Set<() => void>()).current;
  const files = useLazyRef<Map<string, File>>(() => new Map()).current;
  const inputRef = useRef<HTMLInputElement>(null);

  const store = useMemo(() => createStore(listeners, files, invalid, onValueChange), [listeners, files, invalid, onValueChange]);

  useEffect(() => {
    store.dispatch({ type: 'SET_FILES', files: value });
  }, [value, store]);

  const onFilesChange = useCallback(
    (files: File[]) => {
      if (disabled) return;

      if (files.length > 0) {
        store.dispatch({ type: 'ADD_FILES', files });

        const currentFiles = [...store.getState().files].map(([id, file]) => ({ id, file }));
        onValueChange([...currentFiles]);
      }
    },
    [store, onValueChange, disabled],
  );

  const onInputChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const files = [...(event.target.files ?? [])];
      onFilesChange(files);
      event.target.value = '';
    },
    [onFilesChange],
  );

  const contextValue = useMemo<FileUploadContextValue>(
    () => ({
      dropzoneId,
      inputId,
      listId,
      labelId,
      dir,
      disabled,
      inputRef,
    }),
    [dropzoneId, inputId, listId, labelId, dir, disabled],
  );

  const RootPrimitive = asChild ? Slot : 'div';

  return (
    <StoreContext value={store}>
      <FileUploadContext value={contextValue}>
        <RootPrimitive data-disabled={disabled ? '' : undefined} data-slot="file-upload" dir={dir} {...rootProps} className={cn('relative flex flex-col gap-2', className)}>
          {children}
          <input
            type="file"
            id={inputId}
            aria-labelledby={labelId}
            aria-describedby={dropzoneId}
            ref={inputRef}
            tabIndex={-1}
            accept={accept}
            name={name}
            className="sr-only"
            disabled={disabled}
            multiple={multiple}
            required={required}
            onChange={onInputChange}
          />
          <span id={labelId} className="sr-only">
            {label ?? 'File upload'}
          </span>
        </RootPrimitive>
      </FileUploadContext>
    </StoreContext>
  );
}

interface FileUploadDropzoneProps extends ComponentProps<'div'> {
  asChild?: boolean;
}

function FileUploadDropzone(props: FileUploadDropzoneProps) {
  const { asChild, className, onClick: onClickProp, onDragOver: onDragOverProp, onDragEnter: onDragEnterProp, onDragLeave: onDragLeaveProp, onDrop: onDropProp, onPaste: onPasteProp, onKeyDown: onKeyDownProp, ...dropzoneProps } = props;

  const context = useFileUploadContext(DROPZONE_NAME);
  const store = useStoreContext(DROPZONE_NAME);
  const dragOver = useStore((state) => state.dragOver);
  const invalid = useStore((state) => state.invalid);

  const onClick = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      onClickProp?.(event);

      if (event.defaultPrevented) return;

      const target = event.target;

      const isFromTrigger = target instanceof HTMLElement && target.closest('[data-slot="file-upload-trigger"]');

      if (!isFromTrigger) {
        context.inputRef.current?.click();
      }
    },
    [context.inputRef, onClickProp],
  );

  const onDragOver = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      onDragOverProp?.(event);

      if (event.defaultPrevented) return;

      event.preventDefault();
      store.dispatch({ type: 'SET_DRAG_OVER', dragOver: true });
    },
    [store, onDragOverProp],
  );

  const onDragEnter = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      onDragEnterProp?.(event);

      if (event.defaultPrevented) return;

      event.preventDefault();
      store.dispatch({ type: 'SET_DRAG_OVER', dragOver: true });
    },
    [store, onDragEnterProp],
  );

  const onDragLeave = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      onDragLeaveProp?.(event);

      if (event.defaultPrevented) return;

      const relatedTarget = event.relatedTarget;
      if (relatedTarget && relatedTarget instanceof Node && event.currentTarget.contains(relatedTarget)) {
        return;
      }

      event.preventDefault();
      store.dispatch({ type: 'SET_DRAG_OVER', dragOver: false });
    },
    [store, onDragLeaveProp],
  );

  const onDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      onDropProp?.(event);

      if (event.defaultPrevented) return;

      event.preventDefault();
      store.dispatch({ type: 'SET_DRAG_OVER', dragOver: false });

      const files = [...event.dataTransfer.files];
      const inputElement = context.inputRef.current;
      if (!inputElement) return;

      const dataTransfer = new DataTransfer();
      for (const file of files) {
        dataTransfer.items.add(file);
      }

      inputElement.files = dataTransfer.files;
      inputElement.dispatchEvent(new Event('change', { bubbles: true }));
    },
    [store, context.inputRef, onDropProp],
  );

  const onPaste = useCallback(
    (event: ClipboardEvent<HTMLDivElement>) => {
      onPasteProp?.(event);

      if (event.defaultPrevented) return;

      event.preventDefault();
      store.dispatch({ type: 'SET_DRAG_OVER', dragOver: false });

      const items = event.clipboardData.items;

      const files: File[] = [];
      for (const item of items) {
        if (item.kind === 'file') {
          const file = item.getAsFile();
          if (file) {
            files.push(file);
          }
        }
      }

      if (files.length === 0) return;

      const inputElement = context.inputRef.current;
      if (!inputElement) return;

      const dataTransfer = new DataTransfer();
      for (const file of files) {
        dataTransfer.items.add(file);
      }

      inputElement.files = dataTransfer.files;
      inputElement.dispatchEvent(new Event('change', { bubbles: true }));
    },
    [store, context.inputRef, onPasteProp],
  );

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      onKeyDownProp?.(event);

      if (!event.defaultPrevented && (event.key === 'Enter' || event.key === ' ')) {
        event.preventDefault();
        context.inputRef.current?.click();
      }
    },
    [context.inputRef, onKeyDownProp],
  );

  const DropzonePrimitive = asChild ? Slot : 'div';

  return (
    // eslint-disable-next-line jsx-a11y-x/role-supports-aria-props
    <DropzonePrimitive
      role="region"
      id={context.dropzoneId}
      aria-controls={`${context.inputId} ${context.listId}`}
      aria-disabled={context.disabled}
      aria-invalid={invalid}
      data-disabled={context.disabled ? '' : undefined}
      data-dragging={dragOver ? '' : undefined}
      data-invalid={invalid ? '' : undefined}
      data-slot="file-upload-dropzone"
      dir={context.dir}
      tabIndex={context.disabled ? undefined : 0}
      {...dropzoneProps}
      className={cn(
        'relative flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 transition-colors outline-none select-none hover:bg-zinc-100/30 focus-visible:border-zinc-400/50 data-[disabled]:pointer-events-none data-[dragging]:border-zinc-400/30 data-[dragging]:bg-zinc-100/30 data-[invalid]:border-red-700 data-[invalid]:ring-red-700/20',
        className,
      )}
      onClick={onClick}
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onKeyDown={onKeyDown}
      onPaste={onPaste}
    />
  );
}

interface FileUploadTriggerProps extends ComponentProps<'button'> {
  asChild?: boolean;
}

function FileUploadTrigger(props: FileUploadTriggerProps) {
  const { asChild, onClick: onClickProp, ...triggerProps } = props;
  const context = useFileUploadContext(TRIGGER_NAME);

  const onClick = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      onClickProp?.(event);

      if (event.defaultPrevented) return;

      context.inputRef.current?.click();
    },
    [context.inputRef, onClickProp],
  );

  const TriggerPrimitive = asChild ? Slot : 'button';

  return <TriggerPrimitive type="button" aria-controls={context.inputId} data-disabled={context.disabled ? '' : undefined} data-slot="file-upload-trigger" {...triggerProps} disabled={context.disabled} onClick={onClick} />;
}

interface FileUploadListProps extends ComponentProps<'div'> {
  orientation?: 'horizontal' | 'vertical';
  asChild?: boolean;
  forceMount?: boolean;
}

function FileUploadList(props: FileUploadListProps) {
  const { className, orientation = 'vertical', asChild, forceMount, ...listProps } = props;

  const context = useFileUploadContext(LIST_NAME);
  const fileCount = useStore((state) => state.files.size);
  const shouldRender = forceMount ?? fileCount > 0;

  if (!shouldRender) return null;

  const ListPrimitive = asChild ? Slot : 'div';

  return (
    // eslint-disable-next-line jsx-a11y-x/role-supports-aria-props
    <ListPrimitive
      role="list"
      id={context.listId}
      aria-orientation={orientation}
      data-orientation={orientation}
      data-slot="file-upload-list"
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      data-state={shouldRender ? 'active' : 'inactive'}
      dir={context.dir}
      {...listProps}
      className={cn(
        'data-[state=inactive]:fade-out-0 data-[state=active]:fade-in-0 data-[state=inactive]:slide-out-to-top-2 data-[state=active]:slide-in-from-top-2 data-[state=active]:animate-in data-[state=inactive]:animate-out flex flex-col gap-2',
        orientation === 'horizontal' && 'flex-row overflow-x-auto p-1.5',
        className,
      )}
    />
  );
}

interface FileUploadItemContextValue {
  id: string;
  file: FileState | undefined;
  nameId: string;
  sizeId: string;
}

const FileUploadItemContext = createContext<FileUploadItemContextValue | null>(null);

function useFileUploadItemContext(consumerName: string) {
  const context = use(FileUploadItemContext);
  if (!context) {
    throw new Error(`\`${consumerName}\` must be used within \`${ITEM_NAME}\``);
  }
  return context;
}

interface FileUploadItemProps extends ComponentProps<'div'> {
  value: string;
  asChild?: boolean;
}

function FileUploadItem(props: FileUploadItemProps) {
  const { value, asChild, className, ...itemProps } = props;

  const id = useId();
  const nameId = `${id}-name`;
  const sizeId = `${id}-size`;

  const context = useFileUploadContext(ITEM_NAME);
  const file = useStore((state) => {
    const f = state.files.get(value);
    return f ? { id: value, file: f } : undefined;
  });
  const fileCount = useStore((state) => state.files.size);
  const fileIndex = useStore((state) => {
    const files = [...state.files.keys()];
    return files.indexOf(value) + 1;
  });

  const itemContext = useMemo(
    () => ({
      id,
      file,
      nameId,
      sizeId,
    }),
    [id, file, nameId, sizeId],
  );

  if (!file) return null;

  const ItemPrimitive = asChild ? Slot : 'div';

  return (
    <FileUploadItemContext value={itemContext}>
      <ItemPrimitive
        role="listitem"
        id={id}
        aria-setsize={fileCount}
        aria-posinset={fileIndex}
        aria-describedby={`${nameId} ${sizeId}`}
        aria-labelledby={nameId}
        data-slot="file-upload-item"
        dir={context.dir}
        {...itemProps}
        className={cn('relative flex items-center gap-2.5 rounded-md border p-3', className)}
      >
        {props.children}
      </ItemPrimitive>
    </FileUploadItemContext>
  );
}

function formatBytes(bytes: number) {
  if (bytes === 0) return '0 B';
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / 1024 ** i).toFixed(i ? 1 : 0)} ${sizes[i]}`;
}

function getFileIcon(file: File) {
  const type = file.type;
  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';

  if (type.startsWith('image/')) {
    return <FontAwesomeIcon icon={faFileImage} />;
  }

  if (type.startsWith('video/')) {
    return <FontAwesomeIcon icon={faFileVideo} />;
  }

  if (type.startsWith('audio/')) {
    return <FontAwesomeIcon icon={faFileAudio} />;
  }

  if (type.startsWith('text/') || ['txt', 'md', 'rtf', 'pdf'].includes(extension)) {
    return <FontAwesomeIcon icon={faFileText} />;
  }

  if (['html', 'css', 'js', 'jsx', 'ts', 'tsx', 'json', 'xml', 'php', 'py', 'rb', 'java', 'c', 'cpp', 'cs'].includes(extension)) {
    return <FontAwesomeIcon icon={faFileCode} />;
  }

  if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2'].includes(extension)) {
    return <FontAwesomeIcon icon={faFileArchive} />;
  }

  if (['exe', 'msi', 'app', 'apk', 'deb', 'rpm'].includes(extension) || type.startsWith('application/')) {
    return <FontAwesomeIcon icon={faGear} />;
  }

  return <FontAwesomeIcon icon={faFile} />;
}

interface FileUploadItemPreviewProps extends ComponentProps<'div'> {
  render?: (file: File, fallback: () => ReactNode) => ReactNode;
  asChild?: boolean;
}

function FileUploadItemPreview(props: FileUploadItemPreviewProps) {
  const { asChild, children, className, ...previewProps } = props;

  const itemContext = useFileUploadItemContext(ITEM_PREVIEW_NAME);

  if (!itemContext.file) return null;

  const ItemPreviewPrimitive = asChild ? Slot : 'div';

  return (
    <ItemPreviewPrimitive aria-labelledby={itemContext.nameId} data-slot="file-upload-preview" {...previewProps} className={cn('relative flex shrink-0 items-center justify-center overflow-hidden [&>svg]:size-10', className)}>
      {getFileIcon(itemContext.file.file)}
      {children}
    </ItemPreviewPrimitive>
  );
}

interface FileUploadItemMetadataProps extends ComponentProps<'div'> {
  asChild?: boolean;
  size?: 'default' | 'sm';
}

function FileUploadItemMetadata(props: FileUploadItemMetadataProps) {
  const { asChild, size = 'default', children, className, ...metadataProps } = props;

  const context = useFileUploadContext(ITEM_METADATA_NAME);
  const itemContext = useFileUploadItemContext(ITEM_METADATA_NAME);

  if (!itemContext.file) return null;

  const ItemMetadataPrimitive = asChild ? Slot : 'div';

  return (
    <ItemMetadataPrimitive data-slot="file-upload-metadata" dir={context.dir} {...metadataProps} className={cn('flex min-w-0 flex-1 flex-col', className)}>
      {children ?? (
        <>
          <span id={itemContext.nameId} className={cn('truncate font-semibold', size === 'sm' && 'leading-snug')}>
            {itemContext.file.file.name}
          </span>
          <span id={itemContext.sizeId} className={cn('zinc-500 truncate text-sm', size === 'sm' && 'leading-snug')}>
            {formatBytes(itemContext.file.file.size)}
          </span>
        </>
      )}
    </ItemMetadataPrimitive>
  );
}

interface FileUploadItemDeleteProps extends ComponentProps<'button'> {
  asChild?: boolean;
}

function FileUploadItemDelete(props: FileUploadItemDeleteProps) {
  const { asChild, onClick: onClickProp, ...deleteProps } = props;

  const store = useStoreContext(ITEM_DELETE_NAME);
  const itemContext = useFileUploadItemContext(ITEM_DELETE_NAME);

  const onClick = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      onClickProp?.(event);

      if (!itemContext.file || event.defaultPrevented) return;

      store.dispatch({
        type: 'REMOVE_FILE',
        id: itemContext.file.id,
      });
    },
    [store, itemContext.file, onClickProp],
  );

  if (!itemContext.file) return null;

  const ItemDeletePrimitive = asChild ? Slot : 'button';

  return <ItemDeletePrimitive type="button" aria-controls={itemContext.id} aria-describedby={itemContext.nameId} data-slot="file-upload-item-delete" {...deleteProps} onClick={onClick} />;
}

interface FileUploadClearProps extends ComponentProps<'button'> {
  forceMount?: boolean;
  asChild?: boolean;
}

function FileUploadClear(props: FileUploadClearProps) {
  const { asChild, forceMount, disabled, onClick: onClickProp, ...clearProps } = props;

  const context = useFileUploadContext(CLEAR_NAME);
  const store = useStoreContext(CLEAR_NAME);
  const fileCount = useStore((state) => state.files.size);

  const isDisabled = disabled ?? context.disabled;

  const onClick = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      onClickProp?.(event);

      if (event.defaultPrevented) return;

      store.dispatch({ type: 'CLEAR' });
    },
    [store, onClickProp],
  );

  const shouldRender = forceMount ?? fileCount > 0;

  if (!shouldRender) return null;

  const ClearPrimitive = asChild ? Slot : 'button';

  return <ClearPrimitive type="button" aria-controls={context.listId} data-slot="file-upload-clear" data-disabled={isDisabled ? '' : undefined} {...clearProps} disabled={isDisabled} onClick={onClick} />;
}

export {
  FileUploadRoot as FileUpload,
  FileUploadDropzone,
  FileUploadTrigger,
  FileUploadList,
  FileUploadItem,
  FileUploadItemPreview,
  FileUploadItemMetadata,
  FileUploadItemDelete,
  FileUploadClear,
  //
  FileUploadRoot as Root,
  FileUploadDropzone as Dropzone,
  FileUploadTrigger as Trigger,
  FileUploadList as List,
  FileUploadItem as Item,
  FileUploadItemPreview as ItemPreview,
  FileUploadItemMetadata as ItemMetadata,
  FileUploadItemDelete as ItemDelete,
  FileUploadClear as Clear,
  //
  useStore as useFileUpload,
  //
};
