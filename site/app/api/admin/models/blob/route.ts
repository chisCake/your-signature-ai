import { NextRequest, NextResponse } from 'next/server';
import { list } from '@vercel/blob';
import { getUser, isAdmin } from '@/lib/utils/auth-server-utils';

export const runtime = 'nodejs';

export async function GET(_req: NextRequest) {
  const user = await getUser();
  if (!(await isAdmin(user))) {
    return NextResponse.json({ detail: 'Forbidden' }, { status: 403 });
  }

  try {
    const data = await list({
      prefix: 'models/',
    });
    return NextResponse.json(data);
  } catch (error) {
    console.error('[blob/list] error', error);
    return NextResponse.json(
      { detail: 'Failed to query Blob storage' },
      { status: 500 }
    );
  }
}
