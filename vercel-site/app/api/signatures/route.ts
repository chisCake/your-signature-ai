import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getUser, isMod } from '@/lib/auth-server-utils';
import { createServiceClient } from '@/lib/supabase/service';
import { getProfile } from '@/lib/supabase/queries';

const bodySchema = z.object({
  csvData: z.string().min(7), // минимум длины заголовка "t,x,y,p\n..."
  inputType: z.enum(['mouse', 'touch', 'pen']),
  userForForgery: z.boolean().optional(),
  targetTable: z.enum(['profiles', 'pseudousers']).optional(),
  targetId: z.string().uuid().optional(),
});

// Получение всех подписей пользователя
// export async function GET(req: NextRequest) {
//     const user = await getUser();

//     if (!user) {
//         return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
//     }

//     const supabaseSR = createServiceClient();
//     const { data, error } = await supabaseSR
//         .from("genuine_signatures")
//         .select("id, user_id, features_table, input_type, user_for_forgery, created_at, updated_at")
//         .eq("user_id", user.sub)
//         .order("created_at", { ascending: false });

//     if (error) {
//         console.error("Select error", error);
//         return NextResponse.json({ error: "Database select failed" }, { status: 500 });
//     }

//     // Преобразуем данные в CSV-представление Signature
//     const signatures = data.map(row => {
//         const csv = String(row.features_table || "");
//         const newlineIndex = csv.indexOf("\n");
//         const header = newlineIndex >= 0 ? csv.slice(0, newlineIndex) : (csv || "t,x,y,p");
//         const rows = newlineIndex >= 0 ? csv.slice(newlineIndex + 1) : "";
//         return {
//             id: row.id,
//             user_id: row.user_id,
//             csv_header: header || "t,x,y,p",
//             csv_rows: rows,
//             status: "accepted" as const,
//             created_at: row.created_at,
//             updated_at: row.updated_at,
//         };
//     });

//     return NextResponse.json({ signatures });
// }

export async function POST(req: NextRequest) {
  const user = await getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let json;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parse = bodySchema.safeParse(json);
  if (!parse.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parse.error.errors },
      { status: 400 }
    );
  }

  const {
    csvData,
    inputType,
    userForForgery = false,
    targetTable,
    targetId,
  } = parse.data;

  // Determine target user / pseudouser
  let userId: string | null = user.sub;
  let pseudouserId: string | null = null;

  if (targetTable && targetId) {
    if (!(await isMod(user))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (targetTable === 'profiles') {
      userId = targetId;
      pseudouserId = null;
    } else {
      userId = null;
      pseudouserId = targetId;
    }
  }

  const supabaseSR = createServiceClient();
  const { data, error } = await supabaseSR
    .from('genuine_signatures')
    .insert([
      {
        user_id: userId,
        pseudouser_id: pseudouserId,
        features_table: csvData,
        input_type: inputType,
        user_for_forgery: userForForgery,
      },
    ])
    .select('id')
    .single();

  if (error) {
    console.error('Insert error', error);
    return NextResponse.json(
      { error: 'Database insert failed' },
      { status: 500 }
    );
  }

  return NextResponse.json({ id: data.id });
}

// Вспомогательные функции для массового обновления всех подписей пользователя
async function updateUserForForgery(userId: string, userForForgery: boolean) {
  const supabaseSR = createServiceClient();
  const { error } = await supabaseSR
    .from('genuine_signatures')
    .update({ user_for_forgery: userForForgery })
    .eq('user_id', userId);

  if (error) {
    console.error('Update user_for_forgery error', error);
    throw new Error('Database update failed');
  }

  return { user_for_forgery: userForForgery };
}

async function updateModForForgery(userId: string, modForForgery: boolean) {
  const supabaseSR = createServiceClient();
  const { error } = await supabaseSR
    .from('genuine_signatures')
    .update({ mod_for_forgery: modForForgery })
    .eq('user_id', userId);

  if (error) {
    console.error('Update mod_for_forgery error', error);
    throw new Error('Database update failed');
  }

  return { mod_for_forgery: modForForgery };
}

async function updateModForDataset(userId: string, modForDataset: boolean) {
  const supabaseSR = createServiceClient();
  const { error } = await supabaseSR
    .from('genuine_signatures')
    .update({ mod_for_dataset: modForDataset })
    .eq('user_id', userId);

  if (error) {
    console.error('Update mod_for_dataset error', error);
    throw new Error('Database update failed');
  }

  return { mod_for_dataset: modForDataset };
}

export async function PATCH(req: NextRequest) {
  const user = await getUser();
  let targetUserId: string | undefined = user?.sub;

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let json;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (json?.userId !== undefined) {
    targetUserId = json.userId;
    if (!targetUserId) {
      return NextResponse.json({ error: 'Invalid user id' }, { status: 400 });
    }

    if (targetUserId !== user?.sub) {
      const response = await getProfile(targetUserId);
      if (!response) {
        return NextResponse.json(
          { error: 'Target user not found' },
          { status: 404 }
        );
      }
      const targetUserRole = response.role;

      if (targetUserRole === 'mod' || targetUserRole === 'admin') {
        return NextResponse.json(
          { error: 'Insufficient permissions for target user' },
          { status: 403 }
        );
      }
    }
  }

  const results: Record<string, unknown> = {};
  const errors: string[] = [];

  // Обработка userForForgery
  if (json?.userForForgery !== undefined) {
    const userForForgery = json.userForForgery;
    if (typeof userForForgery !== 'boolean') {
      errors.push('userForForgery must be boolean');
    } else {
      try {
        const result = await updateUserForForgery(user.sub, userForForgery);
        Object.assign(results, result);
      } catch {
        errors.push('Failed to update user_for_forgery');
      }
    }
  }

  // Обработка modForForgery
  if (json?.modForForgery !== undefined) {
    const modForForgery = json.modForForgery;

    if (typeof modForForgery !== 'boolean') {
      errors.push('modForForgery must be boolean');
    } else if (!(await isMod(user))) {
      errors.push('Insufficient permissions for modForForgery update');
    } else {
      try {
        const result = await updateModForForgery(user.sub, modForForgery);
        Object.assign(results, result);
      } catch {
        errors.push('Failed to update mod_for_forgery');
      }
    }
  }

  // Обработка modForDataset
  if (json?.modForDataset !== undefined) {
    const modForDataset = json.modForDataset;

    if (typeof modForDataset !== 'boolean') {
      errors.push('modForDataset must be boolean');
    } else if (!(await isMod(user))) {
      errors.push('Insufficient permissions for modForDataset update');
    } else {
      try {
        const result = await updateModForDataset(user.sub, modForDataset);
        Object.assign(results, result);
      } catch {
        errors.push('Failed to update mod_for_dataset');
      }
    }
  }

  // Проверяем, были ли переданы какие-либо поля для обновления
  if (
    json?.userForForgery === undefined &&
    json?.modForForgery === undefined &&
    json?.modForDataset === undefined
  ) {
    return NextResponse.json(
      { error: 'No fields to update provided' },
      { status: 400 }
    );
  }

  // Если есть ошибки, возвращаем их
  if (errors.length > 0) {
    return NextResponse.json(
      { error: 'Validation failed', details: errors },
      { status: 400 }
    );
  }

  return NextResponse.json({ success: true, ...results });
}
