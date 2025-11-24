import {
  canDeleteSignature,
  canEditSignature,
} from '@/lib/signature-management-policies';
import {
  deleteSignature,
  getSignature,
  updateModForDataset,
  updateModForForgery,
  updateUserForForgery,
} from '@/lib/supabase/queries';
import { createServiceClient } from '@/lib/supabase/service';
import { SignatureType } from '@/lib/types';
import { getUser } from '@/lib/utils/auth-server-utils';
import { NextRequest, NextResponse } from 'next/server';

function getSignatureType(req: NextRequest): SignatureType {
  return new URL(req.url).searchParams.get('type') as SignatureType;
}

/**
 * Удаляет настоящую/поддельную подпись
 * @param req - запрос с параметром ?type={signatureType}
 * @param params - параметры, ожидается
 * @returns ответ
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: signatureId } = await params;

    const signatureType = getSignatureType(req);
    if (!signatureType) {
      return NextResponse.json(
        { error: 'Type parameter is required' },
        { status: 400 }
      );
    }

    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const client = createServiceClient();
    const signature = await getSignature(signatureId, signatureType, client);
    if (!signature) {
      return NextResponse.json(
        { error: 'Signature not found' },
        { status: 404 }
      );
    }

    if (!(await canDeleteSignature(signature))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const success = await deleteSignature(signatureId, signatureType, client);
    if (!success) {
      return NextResponse.json(
        { error: 'Database delete failed' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[DELETE] error', error);
    console.error('[DELETE] error stack', (error as Error).stack);
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 });
  }
}

/**
 * Изменяет поле userForForgery, modForForgery или modForDataset настоящей/поддельной подписи
 * @param req - запрос с параметром ?type={signatureType} и телом json с полями userForForgery, modForForgery, modForDataset, если поле не указано, то оно не изменяется.
 * **В json должно указываться только одно поле за запрос**
 * @param params - параметры
 * @returns ответ
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: signatureId } = await params;

    const signatureType = getSignatureType(req);
    if (!signatureType) {
      return NextResponse.json(
        { error: 'Type parameter is required' },
        { status: 400 }
      );
    }

    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const client = createServiceClient();
    const signature = await getSignature(signatureId, signatureType, client);
    if (!signature) {
      return NextResponse.json(
        { error: 'Signature not found' },
        { status: 404 }
      );
    }

    const json = await req.json();
    const userForForgery = json.userForForgery ?? null;
    const modForForgery = json.modForForgery ?? null;
    const modForDataset = json.modForDataset ?? null;

    if (
      userForForgery === null &&
      modForForgery === null &&
      modForDataset === null
    ) {
      return NextResponse.json(
        { error: 'No fields to update provided' },
        { status: 400 }
      );
    }

    // Пользователь изменяет поле userForForgery своей настоящей подписи
    if (signatureType === 'genuine' && userForForgery !== null) {
      const success = await updateUserForForgery(
        signatureId,
        userForForgery,
        client
      );
      if (!success) {
        return NextResponse.json(
          { error: 'Database update failed for userForForgery' },
          { status: 500 }
        );
      }

      return NextResponse.json({ success: true });
    }

    // Модератор/админ изменяет поле modForForgery или modForDataset
    if (signatureType === 'genuine' && modForForgery !== null) {
      if (!(await canEditSignature(signature))) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    if (modForForgery !== null) {
      const success = await updateModForForgery(
        signatureId,
        modForForgery,
        client
      );
      if (!success) {
        return NextResponse.json(
          { error: 'Database update failed for modForForgery' },
          { status: 500 }
        );
      }

      return NextResponse.json({ success: true });
    }

    if (modForDataset !== null) {
      const success = await updateModForDataset(
        signatureId,
        modForDataset,
        signatureType,
        client
      );

      if (!success) {
        return NextResponse.json(
          { error: 'Database update failed for modForDataset' },
          { status: 500 }
        );
      }

      return NextResponse.json({ success: true });
    }

    console.error('[api/signatures/[id] PATCH] Unexpected error', {
      signatureId,
      signatureType,
      userForForgery,
      modForForgery,
      modForDataset,
    });
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 });
  } catch (error) {
    console.error('[PATCH] error', error);
    console.trace();
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 });
  }
}
