/**
 * AI Provider Connection Test API Route
 *
 * Tests API key connectivity with different AI providers.
 *
 * Routes:
 * - POST /api/user/ai-settings/test - Test provider connection
 *
 * @module app/api/user/ai-settings/test/route
 */

import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';

import type { NextRequest } from 'next/server';

/**
 * Test OpenAI connection
 */
async function testOpenAI(apiKey: string): Promise<boolean> {
  try {
    const response = await fetch('https://api.openai.com/v1/models', {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Test Anthropic connection
 */
async function testAnthropic(apiKey: string): Promise<boolean> {
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 10,
        messages: [{ role: 'user', content: 'test' }],
      }),
    });
    return response.ok || response.status === 429; // Accept rate limit as valid auth
  } catch {
    return false;
  }
}

/**
 * Test Google AI connection
 */
async function testGoogle(apiKey: string): Promise<boolean> {
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
    );
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Test DeepSeek connection
 */
async function testDeepSeek(apiKey: string): Promise<boolean> {
  try {
    const response = await fetch('https://api.deepseek.com/v1/models', {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * POST /api/user/ai-settings/test
 *
 * Test API key connectivity with a specific provider
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { provider, apiKey } = body as { provider?: string; apiKey?: string };

    if (!provider || !apiKey) {
      return NextResponse.json(
        { error: 'Provider and apiKey are required' },
        { status: 400 }
      );
    }

    let isValid = false;

    switch (provider.toLowerCase()) {
      case 'openai':
        isValid = await testOpenAI(apiKey);
        break;
      case 'anthropic':
        isValid = await testAnthropic(apiKey);
        break;
      case 'google':
        isValid = await testGoogle(apiKey);
        break;
      case 'deepseek':
        isValid = await testDeepSeek(apiKey);
        break;
      default:
        return NextResponse.json(
          { error: 'Unknown provider' },
          { status: 400 }
        );
    }

    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid API key or connection failed' },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `${provider} connection successful`,
      provider,
    });
  } catch (error) {
    console.error('[POST /api/user/ai-settings/test] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
