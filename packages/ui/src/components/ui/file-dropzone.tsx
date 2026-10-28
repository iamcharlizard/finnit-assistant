'use client';

import * as React from 'react';
import { FileIcon, UploadCloudIcon, XIcon } from 'lucide-react';

import { cn } from '../../lib/utils';

type FileRejectionReason = 'too-large' | 'wrong-type';

interface FileRejection {
  file: File;
  reason: FileRejectionReason;
}

interface FileDropzoneProps {
  /** Same syntax as `<input accept>`: '.pdf,image/*,application/json'. */
  accept?: string;
  maxSizeBytes?: number;
  multiple?: boolean;
  /** Passed to the input so mobile browsers can open the camera directly. */
  capture?: 'environment' | 'user';
  /** Controlled list of accepted files. Omit to let the component keep it. */
  value?: File[];
  onChange?: (files: File[]) => void;
  /** Called with the files that failed validation in the last pick/drop. */
  onReject?: (rejections: FileRejection[]) => void;
  disabled?: boolean;
  /** External error (e.g. upload failed); shown under the zone. */
  error?: string;
  name?: string;
  id?: string;
  className?: string;

  /* Texts (English defaults; pass translations from the app). */
  title?: string;
  description?: string;
  dragActiveText?: string;
  removeLabel?: (fileName: string) => string;
  tooLargeText?: (fileName: string, maxSize: string) => string;
  wrongTypeText?: (fileName: string) => string;
  /** Formats byte sizes. The default is locale-free ("1.5 MB"). */
  formatSize?: (bytes: number) => string;
}

function defaultFormatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let size = bytes / 1024;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size >= 10 ? Math.round(size) : size.toFixed(1)} ${units[unit]}`;
}

/** Mirrors the browser's `accept` matching (dropped files skip the picker's filter). */
function matchesAccept(file: File, accept: string | undefined): boolean {
  if (!accept) return true;
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();
  return accept
    .split(',')
    .map((token) => token.trim().toLowerCase())
    .filter(Boolean)
    .some((token) => {
      if (token.startsWith('.')) return name.endsWith(token);
      if (token.endsWith('/*')) return type.startsWith(token.slice(0, -1));
      return type === token;
    });
}

function FileDropzone({
  accept,
  maxSizeBytes,
  multiple = false,
  capture,
  value,
  onChange,
  onReject,
  disabled = false,
  error,
  name,
  id,
  className,
  title = 'Drag a file here or click to choose',
  description,
  dragActiveText = 'Drop to add',
  removeLabel = (fileName) => `Remove ${fileName}`,
  tooLargeText = (fileName, maxSize) =>
    `${fileName} is larger than ${maxSize}.`,
  wrongTypeText = (fileName) => `${fileName} is not a supported file type.`,
  formatSize = defaultFormatSize,
}: FileDropzoneProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const generatedId = React.useId();
  const inputId = id ?? generatedId;
  const descriptionId = `${inputId}-description`;
  const errorId = `${inputId}-error`;

  const [internalFiles, setInternalFiles] = React.useState<File[]>([]);
  const files = value ?? internalFiles;
  const [rejections, setRejections] = React.useState<FileRejection[]>([]);
  const [dragging, setDragging] = React.useState(false);

  const commit = (next: File[]) => {
    if (value === undefined) setInternalFiles(next);
    onChange?.(next);
  };

  const handleFiles = (list: FileList | null) => {
    if (!list || disabled) return;
    const incoming = Array.from(list);
    const accepted: File[] = [];
    const rejected: FileRejection[] = [];
    for (const file of multiple ? incoming : incoming.slice(0, 1)) {
      if (!matchesAccept(file, accept)) {
        rejected.push({ file, reason: 'wrong-type' });
      } else if (maxSizeBytes !== undefined && file.size > maxSizeBytes) {
        rejected.push({ file, reason: 'too-large' });
      } else {
        accepted.push(file);
      }
    }
    setRejections(rejected);
    if (rejected.length > 0) onReject?.(rejected);
    if (accepted.length > 0)
      commit(multiple ? [...files, ...accepted] : accepted);
  };

  const removeFile = (index: number) => {
    commit(files.filter((_, i) => i !== index));
  };

  // Keep the native input in sync (dropped files never reach it) so a plain
  // <form> submit with `name` sends exactly the files shown.
  React.useEffect(() => {
    const input = inputRef.current;
    if (!input || typeof DataTransfer === 'undefined') return;
    try {
      const transfer = new DataTransfer();
      for (const file of files) transfer.items.add(file);
      input.files = transfer.files;
    } catch {
      // Older browsers without a DataTransfer constructor: nothing to sync.
    }
  }, [files]);

  const messages = [
    ...rejections.map(({ file, reason }) =>
      reason === 'too-large'
        ? tooLargeText(file.name, formatSize(maxSizeBytes ?? 0))
        : wrongTypeText(file.name),
    ),
    ...(error ? [error] : []),
  ];
  const describedBy =
    [description ? descriptionId : null, messages.length ? errorId : null]
      .filter(Boolean)
      .join(' ') || undefined;

  return (
    <div
      data-slot="file-dropzone"
      className={cn('flex flex-col gap-2', className)}
    >
      <button
        type="button"
        disabled={disabled}
        aria-describedby={describedBy}
        aria-invalid={messages.length ? true : undefined}
        data-dragging={dragging || undefined}
        onClick={() => inputRef.current?.click()}
        onDragEnter={(event) => {
          event.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          event.dataTransfer.dropEffect = disabled ? 'none' : 'copy';
        }}
        onDragLeave={(event) => {
          if (
            !event.currentTarget.contains(event.relatedTarget as Node | null)
          ) {
            setDragging(false);
          }
        }}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          handleFiles(event.dataTransfer.files);
        }}
        className={cn(
          'flex min-h-36 w-full flex-col items-center justify-center gap-2 rounded-card border-2 border-dashed border-input bg-surface px-6 py-8 text-center outline-none transition-colors',
          'hover:border-ring hover:bg-accent focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40',
          'disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-input disabled:hover:bg-surface',
          'data-[dragging]:border-ring data-[dragging]:bg-accent',
          'aria-invalid:border-expense',
        )}
      >
        <UploadCloudIcon
          aria-hidden
          className="size-8 text-on-surface-variant"
        />
        <span className="text-sm font-medium text-on-background">
          {dragging ? dragActiveText : title}
        </span>
        {description ? (
          <span id={descriptionId} className="text-xs text-on-surface-variant">
            {description}
          </span>
        ) : null}
      </button>

      <input
        ref={inputRef}
        id={inputId}
        type="file"
        name={name}
        accept={accept}
        multiple={multiple}
        capture={capture}
        disabled={disabled}
        tabIndex={-1}
        aria-hidden
        className="sr-only"
        onChange={(event) => handleFiles(event.target.files)}
      />

      {files.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {files.map((file, index) => (
            <li
              key={`${file.name}-${file.size}-${file.lastModified}-${index}`}
              className="flex min-h-11 items-center gap-3 rounded-chip border border-outline bg-surface px-3 py-2"
            >
              <FileIcon
                aria-hidden
                className="size-5 shrink-0 text-on-surface-variant"
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-on-background">
                  {file.name}
                </span>
                <span className="block text-xs text-on-surface-variant">
                  {formatSize(file.size)}
                </span>
              </span>
              <button
                type="button"
                disabled={disabled}
                aria-label={removeLabel(file.name)}
                onClick={() => removeFile(index)}
                className="flex size-11 shrink-0 items-center justify-center rounded-full text-on-surface-variant outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50"
              >
                <XIcon aria-hidden className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {messages.length > 0 ? (
        <div id={errorId} role="alert" className="flex flex-col gap-0.5">
          {messages.map((message, index) => (
            <p key={index} className="text-xs text-expense">
              {message}
            </p>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export {
  FileDropzone,
  type FileDropzoneProps,
  type FileRejection,
  type FileRejectionReason,
};
