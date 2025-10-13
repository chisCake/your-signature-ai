import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { getUser } from '@/lib/auth-server-utils';
import { z } from 'zod';

// GET - возврат случайной подписи для подделки (id, features_table)
export async function GET() {
  const supabaseSR = createServiceClient();

  // Используем RPC функцию для получения случайной записи
  const { data, error } = await supabaseSR.rpc('get_random_forgery_signature');

  if (error) {
    console.error('RPC error', error);
    return NextResponse.json(
      { error: 'Database select failed' },
      { status: 500 }
    );
  }

  if (!data || data.length === 0) {
    return NextResponse.json(
      { error: 'No signatures available for forgery' },
      { status: 404 }
    );
  }

  const signature = data[0];
  return NextResponse.json({
    id: signature.id,
    features_table: signature.features_table,
  });
}

// Схема тела запроса
const bodySchema = z.object({
  originalSignatureId: z.string().uuid(),
  forgedSignatureData: z
    .array(
      z.object({
        timestamp: z.number(),
        x: z.number(),
        y: z.number(),
        pressure: z.number(),
      })
    )
    .min(1),
  inputType: z.enum(['mouse', 'touch', 'pen']),
});

export async function POST(req: NextRequest) {
  let json;
  try {
    json = await req.json();
  } catch (error) {
    console.error('JSON parse error:', error);
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parse = bodySchema.safeParse(json);
  if (!parse.success) {
    console.error('Validation error:', parse.error.errors);
    console.error('Received data:', json);
    return NextResponse.json(
      { error: 'Validation failed', details: parse.error.errors },
      { status: 400 }
    );
  }

  const { originalSignatureId, forgedSignatureData, inputType } = parse.data;

  // Преобразуем массив точек в CSV строку
  const csvData =
    't,x,y,p\n' +
    forgedSignatureData
      .map(
        point => `${point.timestamp},${point.x},${point.y},${point.pressure}`
      )
      .join('\n');

  const supabaseSR = createServiceClient();

  const { data, error } = await supabaseSR
    .from('genuine_signatures')
    .select('id, user_id, pseudouser_id')
    .eq('id', originalSignatureId)
    .single();

  if (error) {
    console.error('Select error', error);
    return NextResponse.json(
      { error: 'Database select failed' },
      { status: 500 }
    );
  }

  if (!data.user_id && !data.pseudouser_id)
    return NextResponse.json(
      { error: 'Оригинальная подпись не имеет владельца' },
      { status: 500 }
    );

  const insertBody = {
    original_signature_id: originalSignatureId,
    features_table: csvData,
    input_type: inputType,
    forger_id: null as string | null,
    original_user_id: null as string | null,
    original_pseudouser_id: null as string | null,
  };

  const user = await getUser();
  if (user) insertBody.forger_id = user.sub;

  if (data.user_id) insertBody.original_user_id = data.user_id;
  if (data.pseudouser_id)
    insertBody.original_pseudouser_id = data.pseudouser_id;

  const { error: forgedError } = await supabaseSR
    .from('forged_signatures')
    .insert(insertBody);

  if (forgedError) {
    console.error('Insert error', forgedError);
    return NextResponse.json(
      { error: 'Database insert failed' },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
