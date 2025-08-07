import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
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