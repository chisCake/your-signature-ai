import { NextRequest, NextResponse } from 'next/server';
import { getUser, isMod } from '@/lib/auth-server-utils';
import { getProfile, getEmail } from '@/lib/supabase/queries';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!id) {
    return NextResponse.json({ error: 'Invalid user id' }, { status: 400 });
  }

  const user = await getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (id !== user.sub && !(await isMod(user))) {
    return NextResponse.json(
      { error: 'Insufficient permissions' },
      { status: 403 }
    );
  }

  const [profile, email] = await Promise.all([getProfile(id), getEmail(id)]);

  return NextResponse.json({ profile, email });
}
