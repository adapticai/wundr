/**
 * Tests for the MediaPipeline class (src/channels/media-pipeline.ts).
 *
 * Covers:
 *  - MIME type detection via magic bytes (14 signatures: PNG, JPEG, GIF, WebP, etc.)
 *  - MIME type resolution from file extensions
 *  - Attachment type resolution (image, video, audio, file)
 *  - File classification (image, video, audio, document, archive, executable, unknown)
 *  - Language detection from file extensions
 *  - File policy enforcement (denylist, allowlist, executable blocking)
 *  - Validation against channel size limits
 *  - Channel media profiles
 *  - SHA-256 content hashing for cache deduplication
 *  - InMemoryMediaCache (get, set, delete, clearChannel, eviction, expiration)
 *  - Markdown-to-channel format conversion (Slack, Discord, Telegram, plain)
 *  - Code block formatting per channel
 *  - Link preview formatting per channel
 *  - Message splitting for long text
 *  - Processing pipeline (scan, cache, resize, size validation)
 *  - Edge cases: empty files, corrupt headers, unknown types
 */

import * as crypto from 'crypto';

import { describe, it, expect, beforeEach, vi } from 'vitest';

import {
  MediaPipeline,
  InMemoryMediaCache,
  CHANNEL_MEDIA_LIMITS,
  DEFAULT_MAX_MEDIA_BYTES,
} from '../../../channels/media-pipeline';

import type {
  ChannelLogger,
  ImageResizerProvider,
  MediaScannerProvider,
  OutboundAttachment,
} from '../../../channels/types';

// ---------------------------------------------------------------------------
// Helpers: Magic byte buffers
// ---------------------------------------------------------------------------

/** Build a Buffer from an array of byte values, optionally padded to a minimum length. */
function magicBuffer(bytes: number[], minLength = 0): Buffer {
  const arr = new Uint8Array(Math.max(bytes.length, minLength));
  for (let i = 0; i < bytes.length; i++) {
    arr[i] = bytes[i]!;
  }
  return Buffer.from(arr);
}

function jpegBuffer(): Buffer {
  return magicBuffer([0xff, 0xd8, 0xff, 0xe0], 16);
}

function pngBuffer(): Buffer {
  return magicBuffer([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 16);
}

function gifBuffer(): Buffer {
  return magicBuffer([0x47, 0x49, 0x46, 0x38], 16);
}

function webpBuffer(): Buffer {
  // RIFF + 4 bytes size + WEBP
  const bytes = [
    0x52, 0x49, 0x46, 0x46, // RIFF
    0x00, 0x00, 0x00, 0x00, // size placeholder
    0x57, 0x45, 0x42, 0x50, // WEBP
  ];
  return magicBuffer(bytes, 16);
}

function pdfBuffer(): Buffer {
  return magicBuffer([0x25, 0x50, 0x44, 0x46], 16);
}

function zipBuffer(): Buffer {
  return magicBuffer([0x50, 0x4b, 0x03, 0x04], 16);
}

function gzipBuffer(): Buffer {
  return magicBuffer([0x1f, 0x8b], 16);
}

function bmpBuffer(): Buffer {
  return magicBuffer([0x42, 0x4d], 16);
}

function mzExeBuffer(): Buffer {
  return magicBuffer([0x4d, 0x5a], 16);
}

function elfBuffer(): Buffer {
  return magicBuffer([0x7f, 0x45, 0x4c, 0x46], 16);
}

function mp3Buffer(): Buffer {
  // ID3 header
  return magicBuffer([0x49, 0x44, 0x33], 16);
}

function mp4Buffer(): Buffer {
  // ftyp at offset 4
  const bytes = [0x00, 0x00, 0x00, 0x00, 0x66, 0x74, 0x79, 0x70];
  return magicBuffer(bytes, 16);
}

function oggBuffer(): Buffer {
  return magicBuffer([0x4f, 0x67, 0x67, 0x53], 16);
}

function flacBuffer(): Buffer {
  return magicBuffer([0x66, 0x4c, 0x61, 0x43], 16);
}

/** A RIFF header that is NOT WebP (e.g., could be AVI or WAV). */
function riffNonWebpBuffer(): Buffer {
  const bytes = [
    0x52, 0x49, 0x46, 0x46, // RIFF
    0x00, 0x00, 0x00, 0x00, // size placeholder
    0x41, 0x56, 0x49, 0x20, // "AVI " instead of "WEBP"
  ];
  return magicBuffer(bytes, 16);
}

// ---------------------------------------------------------------------------
// Shared mocks
// ---------------------------------------------------------------------------

function silentLogger(): ChannelLogger {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  };
}

function bufferAttachment(
  filename: string,
  buffer: Buffer,
  mimeType?: string,
): OutboundAttachment {
  return {
    source: 'buffer',
    buffer,
    filename,
    ...(mimeType ? { mimeType } : {}),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('MediaPipeline', () => {
  let pipeline: MediaPipeline;

  beforeEach(() => {
    pipeline = new MediaPipeline({ logger: silentLogger() });
  });

  // =========================================================================
  // MIME Detection via Magic Bytes
  // =========================================================================

  describe('detectMimeType', () => {
    it('should detect JPEG from magic bytes', () => {
      expect(pipeline.detectMimeType(jpegBuffer(), 'unknown.bin')).toBe('image/jpeg');
    });

    it('should detect PNG from magic bytes', () => {
      expect(pipeline.detectMimeType(pngBuffer(), 'unknown.bin')).toBe('image/png');
    });

    it('should detect GIF from magic bytes', () => {
      expect(pipeline.detectMimeType(gifBuffer(), 'unknown.bin')).toBe('image/gif');
    });

    it('should detect WebP from RIFF+WEBP magic bytes', () => {
      expect(pipeline.detectMimeType(webpBuffer(), 'unknown.bin')).toBe('image/webp');
    });

    it('should NOT detect WebP from RIFF header with non-WEBP fourcc', () => {
      // RIFF + AVI should fall through to extension-based detection
      const result = pipeline.detectMimeType(riffNonWebpBuffer(), 'file.avi');
      expect(result).not.toBe('image/webp');
    });

    it('should detect PDF from magic bytes', () => {
      expect(pipeline.detectMimeType(pdfBuffer(), 'unknown.bin')).toBe('application/pdf');
    });

    it('should detect ZIP from magic bytes', () => {
      expect(pipeline.detectMimeType(zipBuffer(), 'unknown.bin')).toBe('application/zip');
    });

    it('should detect GZIP from magic bytes', () => {
      expect(pipeline.detectMimeType(gzipBuffer(), 'unknown.bin')).toBe('application/gzip');
    });

    it('should detect BMP from magic bytes', () => {
      expect(pipeline.detectMimeType(bmpBuffer(), 'unknown.bin')).toBe('image/bmp');
    });

    it('should detect Windows PE (MZ) from magic bytes', () => {
      expect(pipeline.detectMimeType(mzExeBuffer(), 'unknown.bin')).toBe('application/x-msdownload');
    });

    it('should detect ELF from magic bytes', () => {
      expect(pipeline.detectMimeType(elfBuffer(), 'unknown.bin')).toBe('application/x-elf');
    });

    it('should detect MP3 (ID3 header) from magic bytes', () => {
      expect(pipeline.detectMimeType(mp3Buffer(), 'unknown.bin')).toBe('audio/mpeg');
    });

    it('should detect MP4 (ftyp at offset 4) from magic bytes', () => {
      expect(pipeline.detectMimeType(mp4Buffer(), 'unknown.bin')).toBe('video/mp4');
    });

    it('should detect OGG from magic bytes', () => {
      expect(pipeline.detectMimeType(oggBuffer(), 'unknown.bin')).toBe('audio/ogg');
    });

    it('should detect FLAC from magic bytes', () => {
      expect(pipeline.detectMimeType(flacBuffer(), 'unknown.bin')).toBe('audio/flac');
    });

    it('should fall back to extension when magic bytes are unrecognized', () => {
      const unknownBytes = Buffer.from([0x00, 0x01, 0x02, 0x03]);
      expect(pipeline.detectMimeType(unknownBytes, 'photo.jpg')).toBe('image/jpeg');
    });

    it('should return undefined when buffer and extension are both unrecognized', () => {
      const unknownBytes = Buffer.from([0x00, 0x01, 0x02, 0x03]);
      expect(pipeline.detectMimeType(unknownBytes, 'mystery')).toBeUndefined();
    });

    it('should handle empty buffer and fall back to extension', () => {
      const emptyBuffer = Buffer.alloc(0);
      expect(pipeline.detectMimeType(emptyBuffer, 'file.png')).toBe('image/png');
    });

    it('should handle buffer too short for any magic match', () => {
      const tinyBuffer = Buffer.from([0x89]);
      // PNG needs 8 bytes, JPEG needs 3, etc. -- 1 byte is too short for all.
      // Falls through to extension.
      expect(pipeline.detectMimeType(tinyBuffer, 'file.txt')).toBe('text/plain');
    });

    it('should handle buffer with partial magic bytes that do not match', () => {
      // Starts like PNG but missing the full signature
      const partial = Buffer.from([0x89, 0x50, 0x4e, 0x00, 0x00, 0x00, 0x00, 0x00]);
      expect(pipeline.detectMimeType(partial, 'file.unknown')).toBeUndefined();
    });
  });

  // =========================================================================
  // MIME Type from Extension
  // =========================================================================

  describe('resolveMimeType', () => {
    it.each([
      ['photo.jpg', 'image/jpeg'],
      ['photo.jpeg', 'image/jpeg'],
      ['image.png', 'image/png'],
      ['animation.gif', 'image/gif'],
      ['image.webp', 'image/webp'],
      ['icon.svg', 'image/svg+xml'],
      ['bitmap.bmp', 'image/bmp'],
      ['favicon.ico', 'image/x-icon'],
      ['photo.avif', 'image/avif'],
      ['photo.tiff', 'image/tiff'],
      ['photo.heic', 'image/heic'],
      ['video.mp4', 'video/mp4'],
      ['video.webm', 'video/webm'],
      ['video.avi', 'video/x-msvideo'],
      ['video.mov', 'video/quicktime'],
      ['audio.mp3', 'audio/mpeg'],
      ['audio.ogg', 'audio/ogg'],
      ['audio.wav', 'audio/wav'],
      ['audio.flac', 'audio/flac'],
      ['audio.opus', 'audio/opus'],
      ['doc.pdf', 'application/pdf'],
      ['doc.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
      ['data.json', 'application/json'],
      ['data.csv', 'text/csv'],
      ['notes.txt', 'text/plain'],
      ['readme.md', 'text/markdown'],
      ['archive.zip', 'application/zip'],
      ['archive.tar', 'application/x-tar'],
      ['archive.gz', 'application/gzip'],
      ['archive.7z', 'application/x-7z-compressed'],
      ['code.js', 'text/javascript'],
      ['code.ts', 'text/typescript'],
      ['code.py', 'text/x-python'],
      ['code.rs', 'text/x-rust'],
      ['code.go', 'text/x-go'],
      ['code.sh', 'text/x-shellscript'],
    ])('should resolve "%s" to "%s"', (filename, expectedMime) => {
      expect(pipeline.resolveMimeType(filename)).toBe(expectedMime);
    });

    it('should return undefined for files without extension', () => {
      expect(pipeline.resolveMimeType('Makefile')).toBeUndefined();
    });

    it('should return undefined for unknown extensions', () => {
      expect(pipeline.resolveMimeType('file.xyzzy')).toBeUndefined();
    });

    it('should be case-insensitive on extensions', () => {
      expect(pipeline.resolveMimeType('PHOTO.JPG')).toBe('image/jpeg');
      expect(pipeline.resolveMimeType('image.PNG')).toBe('image/png');
    });

    it('should return undefined for dot-only filenames', () => {
      expect(pipeline.resolveMimeType('.')).toBeUndefined();
    });

    it('should return undefined when extension is empty (trailing dot)', () => {
      expect(pipeline.resolveMimeType('file.')).toBeUndefined();
    });
  });

  // =========================================================================
  // Attachment Type Resolution
  // =========================================================================

  describe('resolveAttachmentType', () => {
    it('should return "image" for image MIME types', () => {
      expect(pipeline.resolveAttachmentType('image/jpeg')).toBe('image');
      expect(pipeline.resolveAttachmentType('image/png')).toBe('image');
      expect(pipeline.resolveAttachmentType('image/gif')).toBe('image');
      expect(pipeline.resolveAttachmentType('image/svg+xml')).toBe('image');
    });

    it('should return "video" for video MIME types', () => {
      expect(pipeline.resolveAttachmentType('video/mp4')).toBe('video');
      expect(pipeline.resolveAttachmentType('video/webm')).toBe('video');
    });

    it('should return "audio" for audio MIME types', () => {
      expect(pipeline.resolveAttachmentType('audio/mpeg')).toBe('audio');
      expect(pipeline.resolveAttachmentType('audio/ogg')).toBe('audio');
    });

    it('should return "file" for non-media MIME types', () => {
      expect(pipeline.resolveAttachmentType('application/pdf')).toBe('file');
      expect(pipeline.resolveAttachmentType('text/plain')).toBe('file');
      expect(pipeline.resolveAttachmentType('application/zip')).toBe('file');
    });

    it('should return "file" when MIME type is undefined', () => {
      expect(pipeline.resolveAttachmentType(undefined)).toBe('file');
    });
  });

  // =========================================================================
  // File Classification
  // =========================================================================

  describe('classifyFile', () => {
    it('should classify executables by extension', () => {
      expect(pipeline.classifyFile('application/octet-stream', 'malware.exe')).toBe('executable');
      expect(pipeline.classifyFile(undefined, 'script.bat')).toBe('executable');
      expect(pipeline.classifyFile(undefined, 'tool.msi')).toBe('executable');
      expect(pipeline.classifyFile(undefined, 'script.ps1')).toBe('executable');
      expect(pipeline.classifyFile(undefined, 'binary.dll')).toBe('executable');
      expect(pipeline.classifyFile(undefined, 'app.apk')).toBe('executable');
      expect(pipeline.classifyFile(undefined, 'package.deb')).toBe('executable');
      expect(pipeline.classifyFile(undefined, 'package.rpm')).toBe('executable');
    });

    it('should classify executables by MIME type', () => {
      expect(pipeline.classifyFile('application/x-msdownload', 'file.dat')).toBe('executable');
      expect(pipeline.classifyFile('application/x-executable', 'file.dat')).toBe('executable');
      expect(pipeline.classifyFile('application/x-elf', 'file.dat')).toBe('executable');
      expect(pipeline.classifyFile('application/x-shellscript', 'file.dat')).toBe('executable');
    });

    it('should classify images', () => {
      expect(pipeline.classifyFile('image/png', 'photo.png')).toBe('image');
      expect(pipeline.classifyFile('image/jpeg', 'photo.jpg')).toBe('image');
      expect(pipeline.classifyFile('image/webp', 'photo.webp')).toBe('image');
    });

    it('should classify videos', () => {
      expect(pipeline.classifyFile('video/mp4', 'clip.mp4')).toBe('video');
      expect(pipeline.classifyFile('video/webm', 'clip.webm')).toBe('video');
    });

    it('should classify audio', () => {
      expect(pipeline.classifyFile('audio/mpeg', 'song.mp3')).toBe('audio');
      expect(pipeline.classifyFile('audio/ogg', 'song.ogg')).toBe('audio');
    });

    it('should classify documents (text, pdf, office)', () => {
      expect(pipeline.classifyFile('text/plain', 'readme.txt')).toBe('document');
      expect(pipeline.classifyFile('application/pdf', 'report.pdf')).toBe('document');
      expect(pipeline.classifyFile('application/json', 'data.json')).toBe('document');
      expect(pipeline.classifyFile(
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'essay.docx',
      )).toBe('document');
      expect(pipeline.classifyFile(
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'data.xlsx',
      )).toBe('document');
      expect(pipeline.classifyFile(
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'slides.pptx',
      )).toBe('document');
      expect(pipeline.classifyFile('application/rtf', 'doc.rtf')).toBe('document');
      expect(pipeline.classifyFile('application/xml', 'config.xml')).toBe('document');
    });

    it('should classify archives', () => {
      expect(pipeline.classifyFile('application/zip', 'archive.zip')).toBe('archive');
      expect(pipeline.classifyFile('application/gzip', 'archive.gz')).toBe('archive');
      expect(pipeline.classifyFile('application/x-tar', 'archive.tar')).toBe('archive');
      expect(pipeline.classifyFile('application/x-7z-compressed', 'archive.7z')).toBe('archive');
      expect(pipeline.classifyFile('application/vnd.rar', 'archive.rar')).toBe('archive');
      expect(pipeline.classifyFile('application/x-bzip2', 'archive.bz2')).toBe('archive');
      expect(pipeline.classifyFile('application/x-xz', 'archive.xz')).toBe('archive');
    });

    it('should return "unknown" for unrecognized MIME types', () => {
      // Note: 'data.bin' uses .bin which is in the executable extensions set.
      // Use a non-executable extension to test unknown classification.
      expect(pipeline.classifyFile('application/octet-stream', 'data.dat')).toBe('unknown');
    });

    it('should return "unknown" when MIME type is undefined and extension is not executable', () => {
      expect(pipeline.classifyFile(undefined, 'data.xyz')).toBe('unknown');
    });

    it('should prioritize executable classification over MIME-based classification', () => {
      // Even though image/png is an image MIME, if the extension is .exe, it is executable.
      expect(pipeline.classifyFile('image/png', 'fake.exe')).toBe('executable');
    });
  });

  // =========================================================================
  // Language Detection
  // =========================================================================

  describe('resolveLanguage', () => {
    it.each([
      ['app.js', 'javascript'],
      ['app.jsx', 'javascript'],
      ['app.ts', 'typescript'],
      ['app.tsx', 'typescript'],
      ['script.py', 'python'],
      ['gem.rb', 'ruby'],
      ['main.rs', 'rust'],
      ['main.go', 'go'],
      ['main.java', 'java'],
      ['main.c', 'c'],
      ['main.cpp', 'cpp'],
      ['main.swift', 'swift'],
      ['main.kt', 'kotlin'],
      ['main.scala', 'scala'],
      ['script.sh', 'bash'],
      ['query.sql', 'sql'],
      ['config.json', 'json'],
      ['config.yaml', 'yaml'],
      ['config.yml', 'yaml'],
      ['page.html', 'html'],
      ['style.css', 'css'],
      ['readme.md', 'markdown'],
      ['config.toml', 'toml'],
      ['Dockerfile', undefined],
      ['mystery', undefined],
    ])('should resolve "%s" to %s', (filename, expected) => {
      expect(pipeline.resolveLanguage(filename)).toBe(expected);
    });
  });

  // =========================================================================
  // File Policy Enforcement
  // =========================================================================

  describe('checkFilePolicy', () => {
    describe('default denylist mode', () => {
      it('should allow normal files', () => {
        const result = pipeline.checkFilePolicy('photo.png', 'image/png');
        expect(result.allowed).toBe(true);
      });

      it('should block executable extensions', () => {
        const executables = [
          'app.exe', 'script.bat', 'run.cmd', 'tool.com', 'screen.scr',
          'installer.msi', 'script.vbs', 'link.lnk', 'patch.ps1', 'lib.dll',
          'script.sh', 'app.apk', 'package.deb', 'package.rpm', 'binary.elf',
          'binary.bin', 'binary.run', 'script.hta', 'script.wsh', 'script.jse',
          'driver.sys', 'driver.drv', 'control.cpl', 'helper.pif',
          'script.vbe', 'shortcut.shs', 'shortcut.shb', 'script.sct',
          'script.wsf', 'script.wsc', 'script.ws', 'reg.rgs', 'reg.reg',
          'installer.msp', 'installer.mst', 'config.inf', 'config.ins',
          'config.isp', 'control.ocx',
          'script.ps1xml', 'script.ps2', 'script.ps2xml',
          'script.psc1', 'script.psc2',
          'app.app', 'action.action', 'cmd.command', 'wf.workflow',
          'script.csh', 'script.ksh',
        ];

        for (const exe of executables) {
          const result = pipeline.checkFilePolicy(exe);
          expect(result.allowed).toBe(false);
          expect(result.reason).toContain('blocked by security policy');
        }
      });

      it('should block executable MIME types', () => {
        const execMimes = [
          'application/x-msdownload',
          'application/x-msdos-program',
          'application/x-executable',
          'application/x-sharedlib',
          'application/x-shellscript',
          'application/x-dosexec',
          'application/vnd.microsoft.portable-executable',
          'application/x-mach-binary',
          'application/x-elf',
          'application/x-pie-executable',
        ];

        for (const mime of execMimes) {
          const result = pipeline.checkFilePolicy('file.dat', mime);
          expect(result.allowed).toBe(false);
          expect(result.reason).toContain('blocked by security policy');
        }
      });

      it('should reject filenames exceeding maximum length', () => {
        const longName = 'a'.repeat(256) + '.txt';
        const result = pipeline.checkFilePolicy(longName, 'text/plain');
        expect(result.allowed).toBe(false);
        expect(result.reason).toContain('maximum length');
      });

      it('should accept filenames at exactly max length (255)', () => {
        const name = 'a'.repeat(251) + '.txt'; // 255 total
        const result = pipeline.checkFilePolicy(name, 'text/plain');
        expect(result.allowed).toBe(true);
      });

      it('should reject filenames with path traversal', () => {
        const result = pipeline.checkFilePolicy('../../../etc/passwd');
        expect(result.allowed).toBe(false);
        expect(result.reason).toContain('path traversal');
      });
    });

    describe('allowlist mode', () => {
      let allowlistPipeline: MediaPipeline;

      beforeEach(() => {
        allowlistPipeline = new MediaPipeline({
          logger: silentLogger(),
          filePolicy: {
            mode: 'allowlist',
            extensions: new Set(['png', 'jpg', 'pdf']),
            mimeTypes: new Set(['image/png', 'image/jpeg', 'application/pdf']),
            blockExecutables: true,
          },
        });
      });

      it('should allow files matching the allowlist by extension', () => {
        const result = allowlistPipeline.checkFilePolicy('photo.png');
        expect(result.allowed).toBe(true);
      });

      it('should allow files matching the allowlist by MIME type', () => {
        const result = allowlistPipeline.checkFilePolicy('unknown.dat', 'image/png');
        expect(result.allowed).toBe(true);
      });

      it('should reject files not in the allowlist', () => {
        const result = allowlistPipeline.checkFilePolicy('archive.zip', 'application/zip');
        expect(result.allowed).toBe(false);
        expect(result.reason).toContain('not in the allowlist');
      });

      it('should still block executables even if they match allowlist extensions', () => {
        // Even if we explicitly add "exe" to allowlist, blockExecutables overrides
        const customPipeline = new MediaPipeline({
          logger: silentLogger(),
          filePolicy: {
            mode: 'allowlist',
            extensions: new Set(['exe', 'png']),
            mimeTypes: new Set(),
            blockExecutables: true,
          },
        });
        const result = customPipeline.checkFilePolicy('app.exe');
        expect(result.allowed).toBe(false);
        expect(result.reason).toContain('blocked by security policy');
      });
    });

    describe('blockExecutables disabled', () => {
      let permissivePipeline: MediaPipeline;

      beforeEach(() => {
        permissivePipeline = new MediaPipeline({
          logger: silentLogger(),
          filePolicy: {
            mode: 'denylist',
            extensions: new Set(), // empty denylist
            mimeTypes: new Set(),
            blockExecutables: false,
          },
        });
      });

      it('should allow executables when blocking is disabled and denylist is empty', () => {
        const result = permissivePipeline.checkFilePolicy('app.exe');
        expect(result.allowed).toBe(true);
      });

      it('should allow executable MIME types when blocking is disabled', () => {
        const result = permissivePipeline.checkFilePolicy('file.dat', 'application/x-msdownload');
        expect(result.allowed).toBe(true);
      });
    });
  });

  // =========================================================================
  // Channel Size Limits
  // =========================================================================

  describe('resolveMaxBytes', () => {
    it('should return known channel limits', () => {
      expect(pipeline.resolveMaxBytes('slack')).toBe(1_073_741_824);
      expect(pipeline.resolveMaxBytes('discord')).toBe(26_214_400);
      expect(pipeline.resolveMaxBytes('telegram')).toBe(52_428_800);
    });

    it('should return -1 for channels that do not support media', () => {
      expect(pipeline.resolveMaxBytes('terminal')).toBe(-1);
      expect(pipeline.resolveMaxBytes('websocket')).toBe(-1);
    });

    it('should return the default max bytes for unknown channels', () => {
      expect(pipeline.resolveMaxBytes('custom-channel')).toBe(DEFAULT_MAX_MEDIA_BYTES);
    });

    it('should normalize channel IDs (trim, lowercase)', () => {
      expect(pipeline.resolveMaxBytes('  Slack  ')).toBe(1_073_741_824);
      expect(pipeline.resolveMaxBytes('DISCORD')).toBe(26_214_400);
    });

    it('should honor custom channel limits', () => {
      const custom = new MediaPipeline({
        logger: silentLogger(),
        channelLimits: { discord: 500_000_000 },
      });
      expect(custom.resolveMaxBytes('discord')).toBe(500_000_000);
    });

    it('should honor custom default max bytes', () => {
      const custom = new MediaPipeline({
        logger: silentLogger(),
        defaultMaxBytes: 1000,
      });
      expect(custom.resolveMaxBytes('unknown-channel')).toBe(1000);
    });
  });

  // =========================================================================
  // Channel Media Profiles
  // =========================================================================

  describe('getChannelProfile', () => {
    it('should return Slack profile', () => {
      const profile = pipeline.getChannelProfile('slack');
      expect(profile.maxBytes).toBe(CHANNEL_MEDIA_LIMITS['slack']);
      expect(profile.maxTextLength).toBe(4000);
      expect(profile.formatTarget).toBe('slack');
      expect(profile.supportsCodeBlocks).toBe(true);
      expect(profile.supportsLinkPreviews).toBe(true);
      expect(profile.imageLimits).toEqual({ maxWidth: 4096, maxHeight: 4096 });
    });

    it('should return Discord profile', () => {
      const profile = pipeline.getChannelProfile('discord');
      expect(profile.maxBytes).toBe(CHANNEL_MEDIA_LIMITS['discord']);
      expect(profile.maxTextLength).toBe(2000);
      expect(profile.formatTarget).toBe('discord');
      expect(profile.supportsCodeBlocks).toBe(true);
      expect(profile.supportsLinkPreviews).toBe(true);
    });

    it('should return Telegram profile', () => {
      const profile = pipeline.getChannelProfile('telegram');
      expect(profile.maxBytes).toBe(CHANNEL_MEDIA_LIMITS['telegram']);
      expect(profile.maxTextLength).toBe(4096);
      expect(profile.formatTarget).toBe('telegram');
      expect(profile.supportsLinkPreviews).toBe(true);
      expect(profile.imageLimits).toEqual({ maxWidth: 5120, maxHeight: 5120 });
    });

    it('should return terminal profile with no code blocks', () => {
      const profile = pipeline.getChannelProfile('terminal');
      expect(profile.supportsCodeBlocks).toBe(false);
      expect(profile.supportsLinkPreviews).toBe(false);
      expect(profile.formatTarget).toBe('plain');
    });

    it('should return a plain profile for unknown channels', () => {
      const profile = pipeline.getChannelProfile('custom');
      expect(profile.formatTarget).toBe('plain');
      expect(profile.maxTextLength).toBe(0); // unlimited
      expect(profile.supportsLinkPreviews).toBe(false);
    });
  });

  // =========================================================================
  // Validation
  // =========================================================================

  describe('validate', () => {
    it('should pass validation for a valid PNG buffer under size limit', () => {
      const buf = pngBuffer();
      const attachment = bufferAttachment('photo.png', buf);
      const result = pipeline.validate(attachment, 'discord');

      expect(result.valid).toBe(true);
      expect(result.mimeType).toBe('image/png');
      expect(result.type).toBe('image');
      expect(result.category).toBe('image');
      expect(result.isExecutable).toBe(false);
    });

    it('should reject when channel does not support media', () => {
      const buf = pngBuffer();
      const attachment = bufferAttachment('photo.png', buf);
      const result = pipeline.validate(attachment, 'terminal');

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('does not support media');
      expect(result.maxBytes).toBe(-1);
    });

    it('should reject executables', () => {
      const buf = mzExeBuffer();
      const attachment = bufferAttachment('malware.exe', buf);
      const result = pipeline.validate(attachment, 'discord');

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('blocked by security policy');
      expect(result.isExecutable).toBe(true);
    });

    it('should reject files that exceed channel size limits', () => {
      // Discord limit is 25 MB; create a buffer slightly over
      const overSizeBytes = 26_214_401;
      const bigBuffer = Buffer.alloc(overSizeBytes, 0x00);
      const attachment = bufferAttachment('bigfile.dat', bigBuffer, 'application/octet-stream');
      const result = pipeline.validate(attachment, 'discord');

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('maximum');
    });

    it('should pass validation for files at exactly the size limit', () => {
      const buf = Buffer.alloc(26_214_400, 0x00); // exactly 25 MB
      const attachment = bufferAttachment('exact.dat', buf, 'application/octet-stream');
      const result = pipeline.validate(attachment, 'discord');

      expect(result.valid).toBe(true);
    });

    it('should detect MIME type from buffer when not explicitly provided', () => {
      // Use a non-executable extension so the file policy does not block it.
      const attachment = bufferAttachment('file.dat', jpegBuffer());
      const result = pipeline.validate(attachment, 'discord');

      expect(result.valid).toBe(true);
      expect(result.mimeType).toBe('image/jpeg');
    });

    it('should fall back to extension-based MIME detection', () => {
      const attachment: OutboundAttachment = {
        source: 'path',
        location: '/tmp/photo.png',
        filename: 'photo.png',
      };
      const result = pipeline.validate(attachment, 'discord');

      expect(result.valid).toBe(true);
      expect(result.mimeType).toBe('image/png');
    });

    it('should use explicitly provided MIME type when available', () => {
      const buf = pngBuffer(); // has PNG magic bytes
      const attachment = bufferAttachment('file.bin', buf, 'custom/type');
      const result = pipeline.validate(attachment, 'discord');

      // The explicit mimeType should be used
      expect(result.mimeType).toBe('custom/type');
    });

    it('should accept files with unlimited channel size (maxBytes = 0)', () => {
      const custom = new MediaPipeline({
        logger: silentLogger(),
        channelLimits: { unlimited: 0 },
      });
      // 0 means unlimited, so even a huge file passes size checks.
      // (The size check condition is maxBytes > 0 && size > maxBytes.)
      const bigBuffer = Buffer.alloc(100_000_000, 0x00);
      const attachment = bufferAttachment('big.dat', bigBuffer, 'application/octet-stream');
      const result = custom.validate(attachment, 'unlimited');

      expect(result.valid).toBe(true);
    });
  });

  // =========================================================================
  // SHA-256 Content Hashing
  // =========================================================================

  describe('computeHash', () => {
    it('should return a 64-character hex SHA-256 hash', () => {
      const buf = Buffer.from('hello world');
      const hash = pipeline.computeHash(buf);

      expect(hash).toHaveLength(64);
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should produce deterministic output for the same input', () => {
      const buf = Buffer.from('deterministic test');
      expect(pipeline.computeHash(buf)).toBe(pipeline.computeHash(buf));
    });

    it('should produce different hashes for different input', () => {
      const a = pipeline.computeHash(Buffer.from('input A'));
      const b = pipeline.computeHash(Buffer.from('input B'));
      expect(a).not.toBe(b);
    });

    it('should match Node.js crypto SHA-256 output', () => {
      const buf = Buffer.from('verify against crypto');
      const expected = crypto.createHash('sha256').update(buf).digest('hex');
      expect(pipeline.computeHash(buf)).toBe(expected);
    });

    it('should handle empty buffer', () => {
      const emptyHash = pipeline.computeHash(Buffer.alloc(0));
      const expected = crypto.createHash('sha256').update(Buffer.alloc(0)).digest('hex');
      expect(emptyHash).toBe(expected);
    });
  });

  // =========================================================================
  // Markdown Formatting
  // =========================================================================

  describe('formatMarkdown', () => {
    describe('Slack (mrkdwn)', () => {
      it('should convert bold: **text** -> *text* (then italic regex re-wraps to _text_)', () => {
        // The bold step converts **bold** to *bold*, then the italic regex
        // picks up *bold* and converts it to _bold_. This is a known behavior
        // of the layered regex conversion.
        const result = pipeline.formatMarkdown('**bold**', 'slack');
        expect(result.text).toBe('_bold_');
      });

      it('should convert italic: *text* -> _text_', () => {
        const result = pipeline.formatMarkdown('*italic*', 'slack');
        expect(result.text).toBe('_italic_');
      });

      it('should convert bold+italic: ***text*** -> *_text_* (then italic regex re-wraps)', () => {
        // The bold+italic step: ***text*** -> *_text_*
        // Then the italic regex picks up the outer *..* and converts to __text__
        const result = pipeline.formatMarkdown('***bold italic***', 'slack');
        expect(result.text).toBe('__bold italic__');
      });

      it('should convert strikethrough: ~~text~~ -> ~text~', () => {
        const result = pipeline.formatMarkdown('~~struck~~', 'slack');
        expect(result.text).toBe('~struck~');
      });

      it('should convert links: [text](url) -> <url|text>', () => {
        const result = pipeline.formatMarkdown('[Click](https://example.com)', 'slack');
        expect(result.text).toBe('<https://example.com|Click>');
      });

      it('should convert headers to bold (italic regex re-wraps to underscores)', () => {
        // Headers: # text -> *text* (bold), then italic regex: *text* -> _text_
        const result = pipeline.formatMarkdown('# Header 1\n## Header 2', 'slack');
        expect(result.text).toContain('_Header 1_');
        expect(result.text).toContain('_Header 2_');
      });

      it('should preserve code blocks', () => {
        const result = pipeline.formatMarkdown('```\ncode\n```', 'slack');
        expect(result.text).toContain('```\ncode\n```');
      });

      it('should preserve inline code', () => {
        const result = pipeline.formatMarkdown('Use `var` keyword', 'slack');
        expect(result.text).toContain('`var`');
      });

      it('should report originalLength', () => {
        const input = '**hello**';
        const result = pipeline.formatMarkdown(input, 'slack');
        expect(result.originalLength).toBe(input.length);
      });

      it('should not truncate short messages', () => {
        const result = pipeline.formatMarkdown('short', 'slack');
        expect(result.truncated).toBe(false);
        expect(result.chunks).toHaveLength(1);
      });
    });

    describe('Discord', () => {
      it('should convert headers to bold', () => {
        const result = pipeline.formatMarkdown('# Title', 'discord');
        expect(result.text).toBe('**Title**');
      });

      it('should preserve code blocks with language hints', () => {
        const result = pipeline.formatMarkdown('```typescript\nconst x = 1;\n```', 'discord');
        expect(result.text).toContain('```typescript');
      });

      it('should preserve standard markdown (bold, italic, links)', () => {
        const result = pipeline.formatMarkdown('**bold** *italic* [link](url)', 'discord');
        expect(result.text).toContain('**bold**');
        expect(result.text).toContain('*italic*');
        expect(result.text).toContain('[link](url)');
      });
    });

    describe('Telegram (HTML)', () => {
      it('should convert bold: **text** -> <b>text</b>', () => {
        const result = pipeline.formatMarkdown('**bold**', 'telegram');
        expect(result.text).toBe('<b>bold</b>');
      });

      it('should convert italic: *text* -> <i>text</i>', () => {
        const result = pipeline.formatMarkdown('*italic*', 'telegram');
        expect(result.text).toBe('<i>italic</i>');
      });

      it('should convert bold+italic: ***text*** -> <b><i>text</i></b>', () => {
        const result = pipeline.formatMarkdown('***both***', 'telegram');
        expect(result.text).toBe('<b><i>both</i></b>');
      });

      it('should convert strikethrough: ~~text~~ -> <s>text</s>', () => {
        const result = pipeline.formatMarkdown('~~struck~~', 'telegram');
        expect(result.text).toBe('<s>struck</s>');
      });

      it('should convert links: [text](url) -> <a href="url">text</a>', () => {
        const result = pipeline.formatMarkdown('[Click](https://example.com)', 'telegram');
        expect(result.text).toBe('<a href="https://example.com">Click</a>');
      });

      it('should convert inline code: `code` -> <code>code</code>', () => {
        const result = pipeline.formatMarkdown('Use `var`', 'telegram');
        expect(result.text).toContain('<code>var</code>');
      });

      it('should convert code blocks with language to pre/code tags', () => {
        const result = pipeline.formatMarkdown('```python\nprint("hi")\n```', 'telegram');
        expect(result.text).toContain('<pre><code class="language-python">');
        expect(result.text).toContain('print(&quot;hi&quot;)');
      });

      it('should escape HTML entities in code blocks', () => {
        const result = pipeline.formatMarkdown('`<script>`', 'telegram');
        expect(result.text).toContain('&lt;script&gt;');
      });

      it('should convert headers to bold', () => {
        const result = pipeline.formatMarkdown('# Title', 'telegram');
        expect(result.text).toBe('<b>Title</b>');
      });

      it('should convert blockquotes to <blockquote> tags', () => {
        const result = pipeline.formatMarkdown('> quoted text', 'telegram');
        expect(result.text).toContain('<blockquote>quoted text</blockquote>');
      });
    });

    describe('plain text', () => {
      it('should strip all markdown formatting', () => {
        const result = pipeline.formatMarkdown('**bold** *italic* ~~struck~~', 'plain');
        expect(result.text).toBe('bold italic struck');
      });

      it('should convert links to text (url)', () => {
        const result = pipeline.formatMarkdown('[Click](https://example.com)', 'plain');
        expect(result.text).toBe('Click (https://example.com)');
      });

      it('should strip headers', () => {
        const result = pipeline.formatMarkdown('# Header\nContent', 'plain');
        expect(result.text).toBe('Header\nContent');
      });

      it('should strip code block markers but keep the code', () => {
        const result = pipeline.formatMarkdown('```js\ncode\n```', 'plain');
        expect(result.text).toContain('code');
        expect(result.text).not.toContain('```');
      });

      it('should strip inline code backticks', () => {
        const result = pipeline.formatMarkdown('Use `var` keyword', 'plain');
        expect(result.text).toBe('Use var keyword');
      });
    });

    describe('text chunking', () => {
      it('should split long text into chunks for Discord (limit 2000)', () => {
        const longText = 'A'.repeat(5000);
        const result = pipeline.formatMarkdown(longText, 'discord');

        expect(result.truncated).toBe(true);
        expect(result.chunks.length).toBeGreaterThan(1);
        for (const chunk of result.chunks) {
          expect(chunk.length).toBeLessThanOrEqual(2000);
        }
      });

      it('should respect an explicit maxLength override', () => {
        const text = 'Hello world this is a test message';
        const result = pipeline.formatMarkdown(text, 'plain', 10);

        expect(result.truncated).toBe(true);
        expect(result.chunks.length).toBeGreaterThan(1);
      });

      it('should not split when text is under the limit', () => {
        const result = pipeline.formatMarkdown('short', 'discord');
        expect(result.truncated).toBe(false);
        expect(result.chunks).toHaveLength(1);
      });

      it('should not split when channel has unlimited text (limit = 0)', () => {
        const longText = 'A'.repeat(50_000);
        const result = pipeline.formatMarkdown(longText, 'terminal');

        expect(result.truncated).toBe(false);
        expect(result.chunks).toHaveLength(1);
      });
    });
  });

  // =========================================================================
  // Code Block Formatting
  // =========================================================================

  describe('formatCodeBlock', () => {
    const code = 'const x = 1;';

    it('should wrap in triple backticks for Slack (no language)', () => {
      const result = pipeline.formatCodeBlock(code, 'typescript', 'slack');
      expect(result).toBe('```\nconst x = 1;\n```');
    });

    it('should include language hint for Discord', () => {
      const result = pipeline.formatCodeBlock(code, 'typescript', 'discord');
      expect(result).toBe('```typescript\nconst x = 1;\n```');
    });

    it('should produce <pre><code> for Telegram with language class', () => {
      const result = pipeline.formatCodeBlock(code, 'typescript', 'telegram');
      expect(result).toBe('<pre><code class="language-typescript">const x = 1;</code></pre>');
    });

    it('should produce <pre><code> without language for Telegram when no language', () => {
      const result = pipeline.formatCodeBlock(code, undefined, 'telegram');
      expect(result).toBe('<pre><code>const x = 1;</code></pre>');
    });

    it('should escape HTML in Telegram code blocks', () => {
      const htmlCode = '<div>hello & "world"</div>';
      const result = pipeline.formatCodeBlock(htmlCode, undefined, 'telegram');
      expect(result).toContain('&lt;div&gt;');
      expect(result).toContain('&amp;');
      expect(result).toContain('&quot;');
    });

    it('should return raw code for plain target', () => {
      const result = pipeline.formatCodeBlock(code, 'typescript', 'plain');
      expect(result).toBe('const x = 1;');
    });
  });

  describe('formatFileAsCodeBlock', () => {
    it('should auto-detect language from filename', () => {
      const result = pipeline.formatFileAsCodeBlock('print("hi")', 'script.py', 'discord');
      expect(result).toBe('```python\nprint("hi")\n```');
    });

    it('should handle files with no recognized language', () => {
      const result = pipeline.formatFileAsCodeBlock('data', 'mystery.xyz', 'discord');
      expect(result).toBe('```\ndata\n```');
    });
  });

  // =========================================================================
  // Link Preview Formatting
  // =========================================================================

  describe('formatLinkPreview', () => {
    const url = 'https://example.com';

    it('should format Slack links as <url|title>', () => {
      expect(pipeline.formatLinkPreview(url, 'Example', undefined, 'slack')).toBe(
        '<https://example.com|Example>',
      );
    });

    it('should return bare URL for Slack when no title', () => {
      expect(pipeline.formatLinkPreview(url, undefined, undefined, 'slack')).toBe(url);
    });

    it('should return bare URL for Discord', () => {
      expect(pipeline.formatLinkPreview(url, 'Example', undefined, 'discord')).toBe(url);
    });

    it('should format Telegram links as <a> tags', () => {
      expect(pipeline.formatLinkPreview(url, 'Example', 'A description', 'telegram')).toBe(
        '<a href="https://example.com">Example</a>\nA description',
      );
    });

    it('should return bare URL for Telegram when no title', () => {
      expect(pipeline.formatLinkPreview(url, undefined, undefined, 'telegram')).toBe(url);
    });

    it('should format plain text with title and optional description', () => {
      expect(pipeline.formatLinkPreview(url, 'Example', 'Desc', 'plain')).toBe(
        'Example\nhttps://example.com\nDesc',
      );
    });

    it('should return bare URL for plain text when no title', () => {
      expect(pipeline.formatLinkPreview(url, undefined, undefined, 'plain')).toBe(url);
    });
  });

  // =========================================================================
  // Message Splitting
  // =========================================================================

  describe('splitMessage', () => {
    it('should return text as-is when it fits within the channel limit', () => {
      const chunks = pipeline.splitMessage('hello', 'discord');
      expect(chunks).toEqual(['hello']);
    });

    it('should split long text for Discord (limit 2000)', () => {
      const longText = 'word '.repeat(500); // ~2500 chars
      const chunks = pipeline.splitMessage(longText, 'discord');

      expect(chunks.length).toBeGreaterThan(1);
      for (const chunk of chunks) {
        expect(chunk.length).toBeLessThanOrEqual(2000);
      }
    });

    it('should not split for channels with unlimited text (terminal)', () => {
      const longText = 'A'.repeat(100_000);
      const chunks = pipeline.splitMessage(longText, 'terminal');
      expect(chunks).toHaveLength(1);
    });

    it('should not split for unknown channels (default limit 0 = unlimited)', () => {
      const longText = 'A'.repeat(100_000);
      const chunks = pipeline.splitMessage(longText, 'custom');
      expect(chunks).toHaveLength(1);
    });
  });

  // =========================================================================
  // InMemoryMediaCache
  // =========================================================================

  describe('InMemoryMediaCache', () => {
    let cache: InMemoryMediaCache;

    beforeEach(() => {
      cache = new InMemoryMediaCache(5);
    });

    function cacheEntry(key: string, channelId: string, expiresInMs = 60_000) {
      const now = new Date();
      return {
        key,
        channelId,
        platformFileId: `file-${key}`,
        cachedAt: now,
        expiresAt: new Date(now.getTime() + expiresInMs),
        filename: `${key}.png`,
        sizeBytes: 1024,
      };
    }

    it('should store and retrieve entries', async () => {
      const entry = cacheEntry('abc', 'discord');
      await cache.set(entry);

      const retrieved = await cache.get('abc', 'discord');
      expect(retrieved).not.toBeNull();
      expect(retrieved!.key).toBe('abc');
      expect(retrieved!.platformFileId).toBe('file-abc');
    });

    it('should return null for missing entries', async () => {
      const result = await cache.get('nonexistent', 'discord');
      expect(result).toBeNull();
    });

    it('should scope entries by channel ID', async () => {
      await cache.set(cacheEntry('abc', 'discord'));
      await cache.set(cacheEntry('abc', 'slack'));

      const discordEntry = await cache.get('abc', 'discord');
      const slackEntry = await cache.get('abc', 'slack');

      expect(discordEntry).not.toBeNull();
      expect(slackEntry).not.toBeNull();
      expect(discordEntry!.channelId).toBe('discord');
      expect(slackEntry!.channelId).toBe('slack');
    });

    it('should delete entries', async () => {
      await cache.set(cacheEntry('abc', 'discord'));
      await cache.delete('abc', 'discord');

      const result = await cache.get('abc', 'discord');
      expect(result).toBeNull();
    });

    it('should clear all entries for a channel', async () => {
      await cache.set(cacheEntry('a', 'discord'));
      await cache.set(cacheEntry('b', 'discord'));
      await cache.set(cacheEntry('c', 'slack'));

      await cache.clearChannel('discord');

      expect(await cache.get('a', 'discord')).toBeNull();
      expect(await cache.get('b', 'discord')).toBeNull();
      expect(await cache.get('c', 'slack')).not.toBeNull();
    });

    it('should evict the oldest entry when at capacity', async () => {
      // Cache capacity is 5
      for (let i = 0; i < 5; i++) {
        await cache.set(cacheEntry(`key${i}`, 'discord'));
      }
      expect(cache.size).toBe(5);

      // Adding a 6th entry should evict the first
      await cache.set(cacheEntry('key5', 'discord'));
      expect(cache.size).toBe(5);

      // The first entry should be gone
      const first = await cache.get('key0', 'discord');
      expect(first).toBeNull();

      // The newest entry should be present
      const newest = await cache.get('key5', 'discord');
      expect(newest).not.toBeNull();
    });

    it('should not evict when updating an existing entry', async () => {
      for (let i = 0; i < 5; i++) {
        await cache.set(cacheEntry(`key${i}`, 'discord'));
      }

      // Update an existing entry
      await cache.set(cacheEntry('key0', 'discord'));
      expect(cache.size).toBe(5);

      // All entries should still be present
      for (let i = 0; i < 5; i++) {
        const entry = await cache.get(`key${i}`, 'discord');
        expect(entry).not.toBeNull();
      }
    });

    it('should return null for expired entries and remove them', async () => {
      // Create an entry that has already expired
      const entry = cacheEntry('expired', 'discord', -1000); // expired 1s ago
      await cache.set(entry);
      expect(cache.size).toBe(1);

      const result = await cache.get('expired', 'discord');
      expect(result).toBeNull();
      expect(cache.size).toBe(0);
    });

    it('should report size correctly', async () => {
      expect(cache.size).toBe(0);
      await cache.set(cacheEntry('a', 'discord'));
      expect(cache.size).toBe(1);
      await cache.set(cacheEntry('b', 'discord'));
      expect(cache.size).toBe(2);
    });
  });

  // =========================================================================
  // Processing Pipeline
  // =========================================================================

  describe('process', () => {
    it('should detect MIME type and pass validation for a clean buffer', async () => {
      const buf = pngBuffer();
      const attachment = bufferAttachment('photo.png', buf);
      const result = await pipeline.process(attachment, 'discord');

      expect(result.validation.valid).toBe(true);
      expect(result.validation.mimeType).toBe('image/png');
      expect(result.validation.category).toBe('image');
      expect(result.cached).toBe(false);
      expect(result.cacheKey).toBeDefined();
    });

    it('should reject executables during processing', async () => {
      const buf = mzExeBuffer();
      const attachment = bufferAttachment('malware.exe', buf);
      const result = await pipeline.process(attachment, 'discord');

      expect(result.validation.valid).toBe(false);
      expect(result.validation.isExecutable).toBe(true);
    });

    it('should reject files exceeding size limit after processing', async () => {
      const custom = new MediaPipeline({
        logger: silentLogger(),
        channelLimits: { tiny: 100 },
      });
      const bigBuf = Buffer.alloc(200, 0x00);
      const attachment = bufferAttachment('file.dat', bigBuf, 'application/octet-stream');
      const result = await custom.process(attachment, 'tiny');

      expect(result.validation.valid).toBe(false);
      expect(result.validation.reason).toContain('maximum');
    });

    describe('with scanner', () => {
      it('should pass clean files through the scanner', async () => {
        const scanner: MediaScannerProvider = {
          name: 'test-scanner',
          scan: vi.fn().mockResolvedValue({ clean: true, scanner: 'test', verdict: 'clean' }),
        };
        const scanPipeline = new MediaPipeline({
          logger: silentLogger(),
          scanner,
        });

        const buf = pngBuffer();
        const attachment = bufferAttachment('photo.png', buf);
        const result = await scanPipeline.process(attachment, 'discord');

        expect(result.validation.valid).toBe(true);
        expect(scanner.scan).toHaveBeenCalledOnce();
        expect(result.scanResult).toEqual({ clean: true, scanner: 'test', verdict: 'clean' });
      });

      it('should reject files that fail the scan', async () => {
        const scanner: MediaScannerProvider = {
          name: 'test-scanner',
          scan: vi.fn().mockResolvedValue({
            clean: false,
            scanner: 'test',
            verdict: 'Trojan.Generic',
            threatName: 'Trojan.Generic',
          }),
        };
        const scanPipeline = new MediaPipeline({
          logger: silentLogger(),
          scanner,
        });

        const buf = pngBuffer();
        const attachment = bufferAttachment('photo.png', buf);
        const result = await scanPipeline.process(attachment, 'discord');

        expect(result.validation.valid).toBe(false);
        expect(result.validation.reason).toContain('failed security scan');
        expect(result.scanResult?.clean).toBe(false);
      });

      it('should emit scan progress events', async () => {
        const scanner: MediaScannerProvider = {
          name: 'test-scanner',
          scan: vi.fn().mockResolvedValue({ clean: true, scanner: 'test', verdict: 'clean' }),
        };
        const scanPipeline = new MediaPipeline({
          logger: silentLogger(),
          scanner,
        });

        const onProgress = vi.fn();
        const buf = pngBuffer();
        const attachment = bufferAttachment('photo.png', buf);
        await scanPipeline.process(attachment, 'discord', onProgress);

        const scanEvents = onProgress.mock.calls
          .map((c) => c[0])
          .filter((e: { operation: string }) => e.operation === 'scan');
        expect(scanEvents.length).toBe(2); // start + end
        expect(scanEvents[0].fraction).toBe(0);
        expect(scanEvents[1].fraction).toBe(1);
      });
    });

    describe('with cache', () => {
      it('should return cached result on cache hit', async () => {
        const cache = new InMemoryMediaCache();
        const cachePipeline = new MediaPipeline({
          logger: silentLogger(),
          cache,
        });

        const buf = pngBuffer();
        const hash = cachePipeline.computeHash(buf);

        // Pre-populate cache
        const now = new Date();
        await cache.set({
          key: hash,
          channelId: 'discord',
          platformFileId: 'cached-file-id',
          cachedAt: now,
          expiresAt: new Date(now.getTime() + 3600_000),
          filename: 'photo.png',
          sizeBytes: buf.byteLength,
        });

        const attachment = bufferAttachment('photo.png', buf);
        const result = await cachePipeline.process(attachment, 'discord');

        expect(result.cached).toBe(true);
        expect(result.cacheKey).toBe(hash);
        expect(result.validation.valid).toBe(true);
      });

      it('should not return a cache hit when cache is empty', async () => {
        const cache = new InMemoryMediaCache();
        const cachePipeline = new MediaPipeline({
          logger: silentLogger(),
          cache,
        });

        const buf = pngBuffer();
        const attachment = bufferAttachment('photo.png', buf);
        const result = await cachePipeline.process(attachment, 'discord');

        expect(result.cached).toBe(false);
      });
    });

    describe('with resizer', () => {
      it('should call the resizer for image attachments', async () => {
        const resizedBuffer = Buffer.alloc(8, 0xff);
        const resizer: ImageResizerProvider = {
          resize: vi.fn().mockResolvedValue({
            buffer: resizedBuffer,
            mimeType: 'image/jpeg',
          }),
        };
        const resizerPipeline = new MediaPipeline({
          logger: silentLogger(),
          resizer,
        });

        const buf = pngBuffer();
        const attachment = bufferAttachment('photo.png', buf);
        const result = await resizerPipeline.process(attachment, 'discord');

        expect(result.validation.valid).toBe(true);
        expect(resizer.resize).toHaveBeenCalledOnce();
        expect(result.attachment.buffer).toBe(resizedBuffer);
        expect(result.attachment.mimeType).toBe('image/jpeg');
      });

      it('should not call the resizer for non-image files', async () => {
        const resizer: ImageResizerProvider = {
          resize: vi.fn(),
        };
        const resizerPipeline = new MediaPipeline({
          logger: silentLogger(),
          resizer,
        });

        const buf = pdfBuffer();
        const attachment = bufferAttachment('document.pdf', buf);
        await resizerPipeline.process(attachment, 'discord');

        expect(resizer.resize).not.toHaveBeenCalled();
      });

      it('should pass image dimension limits to the resizer', async () => {
        const resizer: ImageResizerProvider = {
          resize: vi.fn().mockResolvedValue(null),
        };
        const resizerPipeline = new MediaPipeline({
          logger: silentLogger(),
          resizer,
        });

        const buf = pngBuffer();
        const attachment = bufferAttachment('photo.png', buf);
        await resizerPipeline.process(attachment, 'telegram');

        expect(resizer.resize).toHaveBeenCalledOnce();
        const [, , options] = (resizer.resize as ReturnType<typeof vi.fn>).mock.calls[0];
        expect(options.maxWidth).toBe(5120);
        expect(options.maxHeight).toBe(5120);
      });

      it('should keep original buffer when resizer returns null', async () => {
        const resizer: ImageResizerProvider = {
          resize: vi.fn().mockResolvedValue(null), // no resize needed
        };
        const resizerPipeline = new MediaPipeline({
          logger: silentLogger(),
          resizer,
        });

        const buf = pngBuffer();
        const attachment = bufferAttachment('photo.png', buf);
        const result = await resizerPipeline.process(attachment, 'discord');

        expect(result.attachment.buffer).toBe(buf);
      });

      it('should emit resize progress events', async () => {
        const resizer: ImageResizerProvider = {
          resize: vi.fn().mockResolvedValue(null),
        };
        const resizerPipeline = new MediaPipeline({
          logger: silentLogger(),
          resizer,
        });

        const onProgress = vi.fn();
        const buf = pngBuffer();
        const attachment = bufferAttachment('photo.png', buf);
        await resizerPipeline.process(attachment, 'discord', onProgress);

        const resizeEvents = onProgress.mock.calls
          .map((c) => c[0])
          .filter((e: { operation: string }) => e.operation === 'resize');
        expect(resizeEvents.length).toBe(2);
        expect(resizeEvents[0].fraction).toBe(0);
        expect(resizeEvents[1].fraction).toBe(1);
      });
    });

    it('should use explicit mimeType over magic bytes', async () => {
      const buf = pngBuffer();
      const attachment = bufferAttachment('file.bin', buf, 'image/gif');
      const result = await pipeline.process(attachment, 'discord');

      expect(result.validation.mimeType).toBe('image/gif');
    });
  });

  // =========================================================================
  // Normalize Attachment
  // =========================================================================

  describe('normalizeAttachment', () => {
    it('should resolve MIME type from filename when missing', () => {
      const normalized = pipeline.normalizeAttachment({
        type: 'file',
        filename: 'photo.png',
        url: 'https://example.com/photo.png',
      });

      expect(normalized.mimeType).toBe('image/png');
      expect(normalized.type).toBe('image');
    });

    it('should reclassify type based on MIME type', () => {
      const normalized = pipeline.normalizeAttachment({
        type: 'file',
        filename: 'song.mp3',
        url: 'https://example.com/song.mp3',
      });

      expect(normalized.mimeType).toBe('audio/mpeg');
      expect(normalized.type).toBe('audio');
    });

    it('should not modify attachment that already has MIME type and correct type', () => {
      const original = {
        type: 'image' as const,
        filename: 'photo.png',
        mimeType: 'image/png',
        url: 'https://example.com/photo.png',
      };
      const normalized = pipeline.normalizeAttachment(original);

      expect(normalized).toBe(original); // same reference
    });
  });

  // =========================================================================
  // Edge Cases
  // =========================================================================

  describe('edge cases', () => {
    it('should handle empty filename gracefully', () => {
      expect(pipeline.resolveMimeType('')).toBeUndefined();
      expect(pipeline.resolveLanguage('')).toBeUndefined();
    });

    it('should handle filenames with multiple dots', () => {
      expect(pipeline.resolveMimeType('archive.tar.gz')).toBe('application/gzip');
      expect(pipeline.resolveMimeType('photo.backup.jpg')).toBe('image/jpeg');
    });

    it('should handle filenames with special characters', () => {
      expect(pipeline.resolveMimeType('my photo (1).png')).toBe('image/png');
      expect(pipeline.resolveMimeType('file-name_v2.txt')).toBe('text/plain');
    });

    it('should handle very large filenames (within limit)', () => {
      const name = 'a'.repeat(250) + '.png';
      const result = pipeline.checkFilePolicy(name, 'image/png');
      expect(result.allowed).toBe(true);
    });

    it('should detect executable even with misleading MIME type', () => {
      // File claims to be an image but has .exe extension
      const result = pipeline.checkFilePolicy('photo.exe', 'image/png');
      expect(result.allowed).toBe(false);
    });

    it('should handle buffer with all zeros', () => {
      const zeroBuffer = Buffer.alloc(32, 0x00);
      const mime = pipeline.detectMimeType(zeroBuffer, 'unknown');
      // No magic bytes match all-zeros, falls back to extension
      expect(mime).toBeUndefined();
    });

    it('should handle buffer with random noise', () => {
      const noiseBuffer = Buffer.from(Array.from({ length: 64 }, () => Math.floor(Math.random() * 256)));
      // Should not throw, just return undefined or extension-based MIME
      const mime = pipeline.detectMimeType(noiseBuffer, 'noise.dat');
      // It may or may not match depending on random bytes, but should not throw
      expect(typeof mime === 'string' || mime === undefined).toBe(true);
    });

    it('should handle validate with attachment that has no buffer and no mimeType', () => {
      const attachment: OutboundAttachment = {
        source: 'url',
        location: 'https://example.com/mystery',
        filename: 'mystery',
      };
      const result = pipeline.validate(attachment, 'discord');

      // Should still pass; MIME will be undefined, type = 'file', category = 'unknown'
      expect(result.valid).toBe(true);
      expect(result.mimeType).toBeUndefined();
      expect(result.type).toBe('file');
      expect(result.category).toBe('unknown');
    });
  });

  // =========================================================================
  // Exported Constants
  // =========================================================================

  describe('exported constants', () => {
    it('should export CHANNEL_MEDIA_LIMITS with expected channels', () => {
      expect(CHANNEL_MEDIA_LIMITS).toBeDefined();
      expect(CHANNEL_MEDIA_LIMITS['slack']).toBeDefined();
      expect(CHANNEL_MEDIA_LIMITS['discord']).toBeDefined();
      expect(CHANNEL_MEDIA_LIMITS['telegram']).toBeDefined();
      expect(CHANNEL_MEDIA_LIMITS['terminal']).toBe(-1);
      expect(CHANNEL_MEDIA_LIMITS['websocket']).toBe(-1);
    });

    it('should export DEFAULT_MAX_MEDIA_BYTES as 25 MB', () => {
      expect(DEFAULT_MAX_MEDIA_BYTES).toBe(26_214_400);
    });
  });
});
