'use client';

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from 'react';

import { FilePreviewModal, type PreviewFile } from './file-preview-modal';

/**
 * Context value for file preview
 */
interface FilePreviewContextValue {
  /** Open the preview modal for a file */
  openPreview: (file: PreviewFile, files?: PreviewFile[]) => void;
  /** Close the preview modal */
  closePreview: () => void;
  /** Whether the preview modal is open */
  isOpen: boolean;
  /** The currently previewed file */
  currentFile: PreviewFile | null;
}

const FilePreviewContext = createContext<FilePreviewContextValue | undefined>(
  undefined
);

/**
 * Hook to access file preview functionality
 */
export function useFilePreview() {
  const context = useContext(FilePreviewContext);
  if (!context) {
    throw new Error('useFilePreview must be used within a FilePreviewProvider');
  }
  return context;
}

/**
 * Provider component for file preview functionality
 */
export function FilePreviewProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentFile, setCurrentFile] = useState<PreviewFile | null>(null);
  const [fileList, setFileList] = useState<PreviewFile[]>([]);

  const openPreview = useCallback(
    (file: PreviewFile, files: PreviewFile[] = []) => {
      setCurrentFile(file);
      setFileList(files.length > 0 ? files : [file]);
      setIsOpen(true);
    },
    []
  );

  const closePreview = useCallback(() => {
    setIsOpen(false);
    // Delay clearing file data to allow for close animation
    setTimeout(() => {
      setCurrentFile(null);
      setFileList([]);
    }, 200);
  }, []);

  const handleFileChange = useCallback((file: PreviewFile) => {
    setCurrentFile(file);
  }, []);

  return (
    <FilePreviewContext.Provider
      value={{
        openPreview,
        closePreview,
        isOpen,
        currentFile,
      }}
    >
      {children}
      <FilePreviewModal
        open={isOpen}
        onOpenChange={open => {
          if (!open) closePreview();
        }}
        file={currentFile}
        files={fileList}
        onFileChange={handleFileChange}
      />
    </FilePreviewContext.Provider>
  );
}

export type { PreviewFile };
