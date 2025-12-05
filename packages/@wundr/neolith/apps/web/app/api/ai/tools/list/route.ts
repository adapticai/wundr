/**
 * AI Tools List API Route
 *
 * Returns available tools based on user permissions.
 */

import { NextRequest, NextResponse } from 'next/server';
import { toolRegistry } from '@/lib/ai/tools/init';
import { auth } from '@/lib/auth';

export const runtime = 'nodejs';

/**
 * Get available tools
 * GET /api/ai/tools/list
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category') as any;
    const format = searchParams.get('format'); // 'openai' for OpenAI function calling format

    // Get user permissions (in real app, fetch from database)
    const userPermissions = [
      'workflow:read',
      'workflow:create',
      'workflow:update',
      'workflow:execute',
      'message:read',
      'file:read',
      'user:read',
      'channel:read',
      'data:read',
      'analytics:read',
      'report:create',
      'search:semantic',
    ];

    // Get tools based on filters
    let tools;
    if (category) {
      tools = toolRegistry.getByCategory(category);
    } else {
      tools = toolRegistry.getAvailableTools(userPermissions);
    }

    // Return in OpenAI format if requested
    if (format === 'openai') {
      return NextResponse.json({
        tools: toolRegistry.getOpenAIFunctions(userPermissions),
      });
    }

    // Return standard format
    return NextResponse.json({
      tools: tools.map(tool => ({
        name: tool.name,
        description: tool.description,
        category: tool.category,
        parameters: tool.parameters,
        requiresApproval: tool.requiresApproval || false,
        cacheable: tool.cacheable || false,
      })),
      count: tools.length,
    });
  } catch (error) {
    console.error('Tool list error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
