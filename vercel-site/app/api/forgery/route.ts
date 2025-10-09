import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

// GET - возврат случайной подписи для подделки (id, features_table)
export async function GET() {
    const supabaseSR = createServiceClient();

    // Используем RPC функцию для получения случайной записи
    const { data, error } = await supabaseSR
        .rpc("get_random_forgery_signature");

    if (error) {
        console.error("RPC error", error);
        return NextResponse.json({ error: "Database select failed" }, { status: 500 });
    }

    if (!data || data.length === 0) {
        return NextResponse.json({ error: "No signatures available for forgery" }, { status: 404 });
    }

    const signature = data[0];
    return NextResponse.json({
        id: signature.id,
        features_table: signature.features_table
    });
}

export async function POST(req: NextRequest) {
    // Get original signature id and forged signature data
    const { originalSignatureId, forgedSignatureData, inputType } = await req.json();

    if (!originalSignatureId || !inputType || !forgedSignatureData || forgedSignatureData.length === 0) {
        return NextResponse.json({ error: "Invalid request data" }, { status: 400 });
    }

    const supabaseSR = createServiceClient();

    const { data, error } = await supabaseSR
        .from("genuine_signatures")
        .select("id, user_id, pseudouser_id")
        .eq("id", originalSignatureId)
        .single();

    if (error) {
        console.error("Select error", error);
        return NextResponse.json({ error: "Database select failed" }, { status: 500 });
    }

    if (!data.user_id && !data.pseudouser_id)
        return NextResponse.json({ error: "Оригинальная подпись не имеет владельца" }, { status: 500 });

    const insertBody = {
        original_signature_id: originalSignatureId,
        features_table: forgedSignatureData,
        input_type: inputType,
        forger_id: null as string | null,
        original_user_id: null as string | null,
        original_pseudouser_id: null as string | null,
    };

    const { data: authData } = await supabaseSR.auth.getClaims();
    const user = authData?.claims;
    if (user) insertBody.forger_id = user.sub;

    if (data.user_id) insertBody.original_user_id = data.user_id;
    if (data.pseudouser_id) insertBody.original_pseudouser_id = data.pseudouser_id;

    const { error: forgedError } = await supabaseSR
        .from("forged_signatures")
        .insert(insertBody);

    if (forgedError) {
        console.error("Insert error", forgedError);
        return NextResponse.json({ error: "Database insert failed" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}