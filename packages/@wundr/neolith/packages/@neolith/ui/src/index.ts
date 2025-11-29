/**
 * @genesis/ui - Genesis UI Component Library
 *
 * A collection of accessible, customizable UI components built with
 * Radix UI primitives and styled with Tailwind CSS.
 *
 * @packageDocumentation
 */

// Utility functions
export { cn } from './lib/utils';

// UI Components
export {
  Button,
  buttonVariants,
  type ButtonProps,
} from './components/ui/button';
export {
  Avatar,
  avatarVariants,
  statusVariants,
  getInitials,
  type AvatarProps,
} from './components/ui/avatar';
export {
  Input,
  inputVariants,
  type InputProps,
} from './components/ui/input';
export {
  Label,
  labelVariants,
  type LabelProps,
} from './components/ui/label';
export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent,
} from './components/ui/card';
export {
  Separator,
  type SeparatorProps,
} from './components/ui/separator';
export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from './components/ui/dialog';
export {
  Progress,
  type ProgressProps,
} from './components/ui/progress';

// File Preview Components
export {
  FilePreview,
  ImagePreview,
  VideoPreview,
  AudioPreview,
  DocumentPreview,
  GenericFilePreview,
  type FilePreviewProps,
  type ImagePreviewProps,
  type VideoPreviewProps,
  type AudioPreviewProps,
  type DocumentPreviewProps,
  type GenericFilePreviewProps,
  formatFileSize,
  getFileExtension,
  detectFileType,
  isPreviewableImage,
  isPreviewableVideo,
  truncateFilename,
  type FileType,
} from './components/file-preview';
