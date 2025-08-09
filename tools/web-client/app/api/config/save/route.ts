import { NextRequest, NextResponse } from 'next/server';

// Force dynamic rendering
export const dynamic = 'force-dynamic';
// Ensure this runs only on Node.js runtime
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    // Dynamic import of Node.js modules to ensure they're only loaded server-side
    const { promises: fs } = await import('fs');
    const path = await import('path');
    
    // Verify we're running in Node.js environment
    if (typeof process === 'undefined' || !process.cwd) {
      throw new Error('This API route requires Node.js runtime');
    }
    
    const config = await request.json();
    
    const configDir = path.join(process.cwd(), '.wundr');
    const configFile = path.join(configDir, 'config.json');

    // Ensure directory exists
    try {
      await fs.access(configDir);
    } catch {
      await fs.mkdir(configDir, { recursive: true });
    }

    // Save configuration
    const configJson = JSON.stringify(config, null, 2);
    await fs.writeFile(configFile, configJson, 'utf8');

    return NextResponse.json({ success: true, message: 'Configuration saved' });
  } catch (error) {
    console.error('Error saving configuration:', error);
    return NextResponse.json(
      { error: 'Failed to save configuration' },
      { status: 500 }
    );
  }
}