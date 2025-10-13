import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerClient as createSSRClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

const createPseudouserSchema = z.object({
  name: z.string().min(1).max(64),
  source: z.string().min(1).max(64),
});

const checkPseudouserSchema = z.object({
  name: z.string().min(1).max(64),
});

export async function GET(req: NextRequest) {
  const supabaseSSR = await createSSRClient();
  const { data: authData } = await supabaseSSR.auth.getClaims();
  const user = authData?.claims;

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(req.url);
  const name = url.searchParams.get('name');

  if (!name) {
    return NextResponse.json(
      { error: 'Name parameter is required' },
      { status: 400 }
    );
  }

  const parse = checkPseudouserSchema.safeParse({ name });
  if (!parse.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parse.error.errors },
      { status: 400 }
    );
  }

  const supabaseSR = createServiceClient();
  const { data, error } = await supabaseSR
    .from('pseudousers')
    .select('id, name, source, created_at')
    .eq('name', parse.data.name)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // No rows found
      return NextResponse.json({ exists: false });
    }
    console.error('Select error', error);
    return NextResponse.json(
      { error: 'Database select failed' },
      { status: 500 }
    );
  }

  return NextResponse.json({
    exists: true,
    pseudouser: {
      id: data.id,
      name: data.name,
      source: data.source,
      created_at: data.created_at,
    },
  });
}

export async function POST(req: NextRequest) {
  const supabaseSSR = await createSSRClient();
  const { data: authData } = await supabaseSSR.auth.getClaims();
  const user = authData?.claims;

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let json;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parse = createPseudouserSchema.safeParse(json);
  if (!parse.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parse.error.errors },
      { status: 400 }
    );
  }

  const { name, source } = parse.data;

  const supabaseSR = createServiceClient();

  // Сначала проверяем, существует ли уже такой пользователь
  const { data: existingUser } = await supabaseSR
    .from('pseudousers')
    .select('id')
    .eq('name', name)
    .single();

  if (existingUser) {
    return NextResponse.json(
      {
        error: 'Pseudouser already exists',
        pseudouser: {
          id: existingUser.id,
          name: name,
          source: source,
        },
      },
      { status: 409 }
    );
  }

  // Создаем нового псевдопользователя
  const { data, error } = await supabaseSR
    .from('pseudousers')
    .insert([
      {
        name,
        source,
      },
    ])
    .select('id, name, source, created_at')
    .single();

  if (error) {
    console.error('Insert error', error);
    return NextResponse.json(
      { error: 'Database insert failed' },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    pseudouser: {
      id: data.id,
      name: data.name,
      source: data.source,
      created_at: data.created_at,
    },
  });
}
