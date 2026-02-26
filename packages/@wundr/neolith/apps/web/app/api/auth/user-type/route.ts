import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { detectUserTypeFromSession } from '@/lib/auth/user-type-detection';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await detectUserTypeFromSession(session);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
