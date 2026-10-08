"use client";

import { useRef, useState } from "react";
import { Upload, Music, FileAudio, FileText, Download } from "lucide-react";
import { toast } from "sonner";

export type FileUploadType = "midi" | "audio" | "tab" | "session" | "all";

const FILE_TYPE_CONFIGS: Record<
  FileUploadType,
  { accept: string; label: string; icon: typeof Music }
> = {
  midi: {
    accept: ".mid,.midi",
    label: "Import MIDI",
    icon: Music,
  },
  audio: {
    accept: ".mp3,.wav,.ogg,.flac,.aac,.m4a,audio/*",
    label: "Import Audio",
    icon: FileAudio,
  },
  tab: {
    accept: ".mid,.midi,.txt",
    label: "Import Tab",
    icon: FileText,
  },
  session: {
    accept: ".json,application/json",
    label: "Import Session",
    icon: Download,
  },
  all: {
    accept: ".mid,.midi,.mp3,.wav,.ogg,.flac,.aac,.m4a,.txt,.json,audio/*",
    label: "Import Files",
    icon: Upload,
  },
};

type FileUploadButtonProps = {
  type: FileUploadType;
  onFilesSelected: (files: FileList | null) => void | Promise<void>;
  multiple?: boolean;
  className?: string;
  disabled?: boolean;
  variant?: "primary" | "secondary";
};

export function FileUploadButton({
  type,
  onFilesSelected,
  multiple = false,
  className = "",
  disabled = false,
  variant = "primary",
}: FileUploadButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isLoading, setIsLoading] = useState(false);

  const config = FILE_TYPE_CONFIGS[type];
  const Icon = config.icon;

  const handleClick = () => {
    if (!disabled && !isLoading) {
      inputRef.current?.click();
    }
  };

  const handleChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setIsLoading(true);
    try {
      await onFilesSelected(files);
      toast.success(`Imported ${files.length} file${files.length > 1 ? "s" : ""}`);
    } catch (error) {
      toast.error((error as Error).message || "Failed to import files");
    } finally {
      setIsLoading(false);
      // Reset input so same file can be selected again
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  };

  const baseClasses =
    "glass-pill inline-flex items-center gap-2 px-4 py-2 text-[10px] font-black uppercase tracking-widest transition";
  const variantClasses =
    variant === "primary"
      ? "hover:border-[var(--color-mint)]"
      : "hover:border-[var(--color-brass)]";
  const disabledClasses = disabled || isLoading ? "opacity-50 cursor-not-allowed" : "";

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        multiple={multiple}
        accept={config.accept}
        className="hidden"
        onChange={handleChange}
        disabled={disabled || isLoading}
      />
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled || isLoading}
        className={`${baseClasses} ${variantClasses} ${disabledClasses} ${className}`}
        title={config.label}
      >
        <Icon className="h-3.5 w-3.5" />
        {isLoading ? "Importing..." : config.label}
      </button>
    </>
  );
}

type MultiFileUploadGroupProps = {
  onMidiFiles?: (files: FileList | null) => void | Promise<void>;
  onAudioFiles?: (files: FileList | null) => void | Promise<void>;
  onTabFiles?: (files: FileList | null) => void | Promise<void>;
  onSessionFiles?: (files: FileList | null) => void | Promise<void>;
  className?: string;
  disabled?: boolean;
};

export function MultiFileUploadGroup({
  onMidiFiles,
  onAudioFiles,
  onTabFiles,
  onSessionFiles,
  className = "",
  disabled = false,
}: MultiFileUploadGroupProps) {
  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      {onMidiFiles && (
        <FileUploadButton
          type="midi"
          onFilesSelected={onMidiFiles}
          disabled={disabled}
          variant="primary"
        />
      )}
      {onAudioFiles && (
        <FileUploadButton
          type="audio"
          onFilesSelected={onAudioFiles}
          disabled={disabled}
          variant="primary"
        />
      )}
      {onTabFiles && (
        <FileUploadButton
          type="tab"
          onFilesSelected={onTabFiles}
          disabled={disabled}
          variant="secondary"
        />
      )}
      {onSessionFiles && (
        <FileUploadButton
          type="session"
          onFilesSelected={onSessionFiles}
          disabled={disabled}
          variant="secondary"
        />
      )}
    </div>
  );
}
