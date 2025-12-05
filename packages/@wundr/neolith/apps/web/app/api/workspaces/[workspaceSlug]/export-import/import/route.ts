/**
 * Import Data API Endpoint
 *
 * POST - Import data from file
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';

import type { NextRequest } from 'next/server';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceSlug: string }> },
): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { workspaceSlug: workspaceId } = await params;

    // Verify workspace access and admin permissions
    const membership = await prisma.workspaceMember.findFirst({
      where: {
        workspaceId,
        userId: session.user.id,
      },
    });

    if (!membership) {
      return NextResponse.json(
        { error: 'Workspace not found or access denied' },
        { status: 404 },
      );
    }

    if (!['ADMIN', 'OWNER'].includes(membership.role)) {
      return NextResponse.json(
        { error: 'Forbidden: Only workspace admins can import data' },
        { status: 403 },
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const platform = formData.get('platform') as string;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 },
      );
    }

    // Validate file type
    const allowedTypes = [
      'application/json',
      'text/csv',
      'application/zip',
    ];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Supports JSON, CSV, and ZIP files' },
        { status: 400 },
      );
    }

    // Read file content
    const fileContent = await file.text();
    let importData: unknown;

    try {
      if (file.type === 'application/json') {
        importData = JSON.parse(fileContent);
      } else if (file.type === 'text/csv') {
        importData = parseCSV(fileContent);
      } else {
        return NextResponse.json(
          { error: 'ZIP import not yet implemented' },
          { status: 501 },
        );
      }
    } catch (error) {
      return NextResponse.json(
        { error: 'Failed to parse file content' },
        { status: 400 },
      );
    }

    // Process import based on platform
    let recordsImported = 0;

    switch (platform) {
      case 'neolith':
        recordsImported = await importNeolithBackup(
          workspaceId,
          importData as NeolithBackup,
        );
        break;
      case 'slack':
        recordsImported = await importSlackData(
          workspaceId,
          importData as SlackExport,
        );
        break;
      case 'discord':
        recordsImported = await importDiscordData(
          workspaceId,
          importData as DiscordExport,
        );
        break;
      case 'teams':
        recordsImported = await importTeamsData(
          workspaceId,
          importData as TeamsExport,
        );
        break;
      default:
        return NextResponse.json(
          { error: `Unsupported platform: ${platform}` },
          { status: 400 },
        );
    }

    return NextResponse.json({
      success: true,
      recordsImported,
      message: `Successfully imported ${recordsImported} records from ${platform}`,
    });
  } catch (error) {
    console.error('Import error:', error);
    return NextResponse.json(
      { error: 'Failed to import data' },
      { status: 500 },
    );
  }
}

// Type definitions
interface NeolithBackup {
  workspace?: unknown;
  channels?: Array<{
    name: string;
    slug?: string;
    description?: string;
    type?: string;
  }>;
  messages?: Array<{
    content: string;
    channelId: string;
    authorId: string;
  }>;
  tasks?: Array<{
    title: string;
    description?: string;
    status?: string;
    priority?: string;
  }>;
}

interface SlackExport {
  channels?: Array<{
    name: string;
    topic?: { value: string };
    purpose?: { value: string };
  }>;
  users?: Array<{
    name: string;
    profile?: { email: string; real_name: string };
  }>;
}

interface DiscordExport {
  channels?: Array<{
    name: string;
    topic?: string;
    type?: number;
  }>;
}

interface TeamsExport {
  channels?: Array<{
    displayName: string;
    description?: string;
  }>;
}

// Import functions
async function importNeolithBackup(
  workspaceId: string,
  data: NeolithBackup,
): Promise<number> {
  let count = 0;

  // Import channels
  if (data.channels && Array.isArray(data.channels)) {
    for (const channel of data.channels) {
      try {
        await prisma.channel.create({
          data: {
            workspaceId,
            name: channel.name,
            slug: channel.slug || channel.name.toLowerCase().replace(/\s+/g, '-'),
            description: channel.description,
            type: (channel.type as 'PUBLIC' | 'PRIVATE') || 'PUBLIC',
          },
        });
        count++;
      } catch (error) {
        console.error('Failed to import channel:', error);
      }
    }
  }

  // Import tasks - Note: Requires orchestratorId and createdById
  // Since we don't have these in the backup, we'll skip task import for now
  // or need to fetch a default orchestrator and use the session user
  if (data.tasks && Array.isArray(data.tasks)) {
    // Get first orchestrator for the workspace (if any)
    const orchestrator = await prisma.orchestrator.findFirst({
      where: { workspaceId },
    });

    if (orchestrator) {
      for (const task of data.tasks) {
        try {
          await prisma.task.create({
            data: {
              workspaceId,
              orchestratorId: orchestrator.id,
              createdById: orchestrator.id, // Using orchestrator ID as creator
              title: task.title,
              description: task.description,
              status:
                (task.status as 'TODO' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED') ||
                'TODO',
              priority:
                (task.priority as 'LOW' | 'MEDIUM' | 'HIGH') ||
                'MEDIUM',
            },
          });
          count++;
        } catch (error) {
          console.error('Failed to import task:', error);
        }
      }
    }
  }

  return count;
}

async function importSlackData(
  workspaceId: string,
  data: SlackExport,
): Promise<number> {
  let count = 0;

  if (data.channels && Array.isArray(data.channels)) {
    for (const channel of data.channels) {
      try {
        await prisma.channel.create({
          data: {
            workspaceId,
            name: channel.name,
            slug: channel.name.toLowerCase().replace(/\s+/g, '-'),
            description:
              channel.topic?.value || channel.purpose?.value || undefined,
            type: 'PUBLIC',
          },
        });
        count++;
      } catch (error) {
        console.error('Failed to import Slack channel:', error);
      }
    }
  }

  return count;
}

async function importDiscordData(
  workspaceId: string,
  data: DiscordExport,
): Promise<number> {
  let count = 0;

  if (data.channels && Array.isArray(data.channels)) {
    for (const channel of data.channels) {
      try {
        // Discord channel type 0 = text, 2 = voice
        const isTextChannel = channel.type === undefined || channel.type === 0;

        if (isTextChannel) {
          await prisma.channel.create({
            data: {
              workspaceId,
              name: channel.name,
              slug: channel.name.toLowerCase().replace(/\s+/g, '-'),
              description: channel.topic || undefined,
              type: 'PUBLIC',
            },
          });
          count++;
        }
      } catch (error) {
        console.error('Failed to import Discord channel:', error);
      }
    }
  }

  return count;
}

async function importTeamsData(
  workspaceId: string,
  data: TeamsExport,
): Promise<number> {
  let count = 0;

  if (data.channels && Array.isArray(data.channels)) {
    for (const channel of data.channels) {
      try {
        await prisma.channel.create({
          data: {
            workspaceId,
            name: channel.displayName,
            slug: channel.displayName.toLowerCase().replace(/\s+/g, '-'),
            description: channel.description || undefined,
            type: 'PUBLIC',
          },
        });
        count++;
      } catch (error) {
        console.error('Failed to import Teams channel:', error);
      }
    }
  }

  return count;
}

function parseCSV(content: string): Array<Record<string, string>> {
  const lines = content.split('\n');
  if (lines.length < 2) {
return [];
}

  const headers = lines[0].split(',').map(h => h.trim());
  const data: Array<Record<string, string>> = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) {
continue;
}

    const values = line.split(',').map(v => v.trim());
    const row: Record<string, string> = {};

    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });

    data.push(row);
  }

  return data;
}
