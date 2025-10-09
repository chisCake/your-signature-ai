"use client";

import { createBrowserClient } from "@/lib/supabase/client";
import { Profile, Signature } from "@/lib/types";
import { getUserGenuineSignatures, getProfile as getProfileQuery } from "@/lib/supabase/queries";

export async function getSignatures(): Promise<Signature[]> {
    const client = createBrowserClient();
    const { data } = await client.auth.getClaims();
    const userId = data?.claims?.sub;

    const signatures = await getUserGenuineSignatures(userId!, client, "user");
    return signatures;
}

export async function getProfile(): Promise<Profile | null> {
    const client = createBrowserClient();
    const { data } = await client.auth.getClaims();
    const userId = data?.claims?.sub;
    const profile = await getProfileQuery(userId!, client);
    return profile;
}