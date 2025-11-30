/**
 * File Tools Index
 *
 * Exports all Neolith file management MCP tools.
 *
 * @module neolith-mcp-server/tools/files
 */

// Types
export * from './types';

// Import handlers and tools explicitly for re-export
import {
  listFilesHandler as _listFilesHandler,
  listFilesTool as _listFilesTool,
  ListFilesInputSchema as _ListFilesInputSchema,
} from './list-files';
import type { ListFilesInput as _ListFilesInput } from './list-files';

import {
  uploadFileHandler as _uploadFileHandler,
  uploadFileTool as _uploadFileTool,
  UploadFileInputSchema as _UploadFileInputSchema,
} from './upload-file';
import type { UploadFileInput as _UploadFileInput } from './upload-file';

import {
  downloadFileHandler as _downloadFileHandler,
  downloadFileTool as _downloadFileTool,
  DownloadFileInputSchema as _DownloadFileInputSchema,
} from './download-file';
import type { DownloadFileInput as _DownloadFileInput } from './download-file';

import {
  shareFileHandler as _shareFileHandler,
  shareFileTool as _shareFileTool,
  ShareFileInputSchema as _ShareFileInputSchema,
} from './share-file';
import type { ShareFileInput as _ShareFileInput } from './share-file';

import {
  deleteFileHandler as _deleteFileHandler,
  deleteFileTool as _deleteFileTool,
  DeleteFileInputSchema as _DeleteFileInputSchema,
} from './delete-file';
import type { DeleteFileInput as _DeleteFileInput } from './delete-file';

import {
  getFileInfoHandler as _getFileInfoHandler,
  getFileInfoTool as _getFileInfoTool,
  GetFileInfoInputSchema as _GetFileInfoInputSchema,
} from './get-file-info';
import type { GetFileInfoInput as _GetFileInfoInput } from './get-file-info';

// Re-export handlers
export const listFilesHandler = _listFilesHandler;
export const uploadFileHandler = _uploadFileHandler;
export const downloadFileHandler = _downloadFileHandler;
export const shareFileHandler = _shareFileHandler;
export const deleteFileHandler = _deleteFileHandler;
export const getFileInfoHandler = _getFileInfoHandler;

// Re-export tools
export const listFilesTool = _listFilesTool;
export const uploadFileTool = _uploadFileTool;
export const downloadFileTool = _downloadFileTool;
export const shareFileTool = _shareFileTool;
export const deleteFileTool = _deleteFileTool;
export const getFileInfoTool = _getFileInfoTool;

// Re-export schemas
export const ListFilesInputSchema = _ListFilesInputSchema;
export const UploadFileInputSchema = _UploadFileInputSchema;
export const DownloadFileInputSchema = _DownloadFileInputSchema;
export const ShareFileInputSchema = _ShareFileInputSchema;
export const DeleteFileInputSchema = _DeleteFileInputSchema;
export const GetFileInfoInputSchema = _GetFileInfoInputSchema;

// Re-export types
export type ListFilesInput = _ListFilesInput;
export type UploadFileInput = _UploadFileInput;
export type DownloadFileInput = _DownloadFileInput;
export type ShareFileInput = _ShareFileInput;
export type DeleteFileInput = _DeleteFileInput;
export type GetFileInfoInput = _GetFileInfoInput;

/**
 * All file tools for registration
 */
export const fileTools = [
  _listFilesTool,
  _uploadFileTool,
  _downloadFileTool,
  _shareFileTool,
  _deleteFileTool,
  _getFileInfoTool,
];

/**
 * File tool handlers map
 */
export const fileHandlers = {
  neolith_list_files: _listFilesHandler,
  neolith_upload_file: _uploadFileHandler,
  neolith_download_file: _downloadFileHandler,
  neolith_share_file: _shareFileHandler,
  neolith_delete_file: _deleteFileHandler,
  neolith_get_file_info: _getFileInfoHandler,
};
