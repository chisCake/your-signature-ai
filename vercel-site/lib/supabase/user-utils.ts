"use client";

import { createBrowserClient } from "../../lib/supabase/client";
import { Signature } from "../../lib/types";
import { getUserGenuineSignatures } from "../../lib/supabase/queries";

export async function getSignatures(): Promise<Signature[]> {
    const client = createBrowserClient();
    const { data } = await client.auth.getClaims();
    const userId = data?.claims?.sub;

    const signatures = await getUserGenuineSignatures(userId!, client, "user");
    return signatures;
}