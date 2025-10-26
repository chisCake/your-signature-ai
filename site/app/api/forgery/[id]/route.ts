import {
  getForgedSignature,
  getGenuineSignature,
  getUserGenuineSignatures,
} from '@/lib/supabase/queries';
import { createServiceClient } from '@/lib/supabase/service';
import { SignatureGenuine, SignaturePoint } from '@/lib/types';
import { getUser, isMod } from '@/lib/utils/auth-server-utils';
import { csvStringToPoints } from '@/lib/utils/signature-utils';
import { NextResponse } from 'next/server';

type ResponseType = 'full' | 'points';

/**
 * Получает features_table или SignatureGenuine для поддельной подписи
 * @param params - параметры, ожидается id поддельной подписи
 * @returns ответ: для обычного пользователя - features_table, для модератора - SignatureGenuine
 * @see {@link SignatureGenuine}
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<
  NextResponse<
    | { type: ResponseType; data: SignaturePoint[] | SignatureGenuine }
    | { error: string }
  >
> {
  try {
    const { id: signatureId } = await params;
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const client = createServiceClient();
    const signature = await getForgedSignature(signatureId, client);
    if (!signature) {
      return NextResponse.json(
        { error: 'Signature not found' },
        { status: 404 }
      );
    }

    const mod = await isMod(user);
    if (!(signature.forger_id === user.id || mod)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const originalSignatureId = signature.original_signature_id;
    if (!originalSignatureId) {
      // Подпись из внешнего датасета/источника. Пробуем взять настоящую подпись пользователя
      const originalSignatureOwnerType = signature.original_user_id
        ? 'user'
        : 'pseudouser';
      const originalSignatureOwnerId =
        signature.original_user_id || signature.original_pseudouser_id;
      if (!originalSignatureOwnerId) {
        return NextResponse.json(
          { error: 'Neither original signature nor original user found' },
          { status: 500 }
        );
      }
      const originalSignature = await getUserGenuineSignatures(
        originalSignatureOwnerId,
        originalSignatureOwnerType,
        client,
        1
      );

      if (!originalSignature) {
        return NextResponse.json(
          { error: 'Sample genuine signature not found' },
          { status: 500 }
        );
      }

      return NextResponse.json(
        mod
          ? { type: 'full', data: originalSignature[0] }
          : {
              type: 'points',
              data: csvStringToPoints(originalSignature[0].features_table),
            }
      );
    } else {
      const originalSignature = await getGenuineSignature(
        originalSignatureId,
        client
      );
      if (!originalSignature) {
        return NextResponse.json(
          { error: 'Original genuine signature not found' },
          { status: 500 }
        );
      }
      return NextResponse.json(
        mod
          ? { type: 'full', data: originalSignature }
          : {
              type: 'points',
              data: csvStringToPoints(originalSignature.features_table),
            }
      );
    }
  } catch (error) {
    console.error('[GET /api/forgery/:id] Unexpected error', error);
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 });
  }
}
