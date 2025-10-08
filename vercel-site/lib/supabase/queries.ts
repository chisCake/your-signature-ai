import {
    Profile,
    Pseudouser,
    SignatureForged,
    SignatureGenuine,
    mapToProfile,
    mapToPseudouser,
    mapToSignatureForged, mapToSignatureGenuine
} from "@/lib/types";
import { createServiceClient } from "@/lib/supabase/service";
import type { SupabaseClient } from "@supabase/supabase-js";

function getClient(supabase?: SupabaseClient) {
    return supabase ?? createServiceClient();
}

// ========================================
// GETS
// ========================================

export async function getProfile(
    id: string,
    supabase?: SupabaseClient,
): Promise<Profile | null> {
    const client = getClient(supabase);
    const { data, error } = await client
        .from("profiles")
        .select("*")
        .eq("id", id)
        .single();

    if (error) {
        console.error("Ошибка получения профиля:", error);
        return null;
    }

    return mapToProfile(data);
}

export async function getPseudouser(
    id: string,
    supabase?: SupabaseClient,
): Promise<Pseudouser | null> {
    const client = getClient(supabase);
    const { data, error } = await client
        .from("pseudousers")
        .select("*")
        .eq("id", id)
        .single();

    if (error) {
        console.error("Ошибка получения псевдопользователя:", error);
        return null;
    }
    return mapToPseudouser(data);
}

export async function getUsers(
    supabase?: SupabaseClient,
): Promise<Profile[]> {
    const client = getClient(supabase);
    const { data, error } = await client.from("profiles").select("*");
    if (error) {
        console.error("Ошибка получения пользователей:", error);
        return [];
    }
    return data.map(mapToProfile);
}

export async function getPseudousers(
    supabase?: SupabaseClient,
): Promise<Pseudouser[]> {
    const client = getClient(supabase);
    const { data, error } = await client.from("pseudousers").select("*");
    if (error) {
        console.error("Ошибка получения псевдопользователей:", error);
        return [];
    }
    return data.map(mapToPseudouser);
}

export async function getEmail(
    id: string,
    supabase?: SupabaseClient,
): Promise<string | null> {
    const client = getClient(supabase);
    const { data, error } = await client.rpc("get_user_email", {
        profile_id: id
    });

    if (error) {
        console.error("Ошибка получения email:", error);
        return null;
    }
    return data;
}

export async function getGenuineSignature(
    id: string,
    supabase?: SupabaseClient,
): Promise<SignatureGenuine | null> {
    const client = getClient(supabase);
    const { data, error } = await client
        .from("genuine_signatures")
        .select("*")
        .eq("id", id)
        .single();

    if (error) {
        console.error("Ошибка получения подписи:", error);
        return null;
    }
    return mapToSignatureGenuine(data);
}


export async function getForgedSignature(
    id: string,
    supabase?: SupabaseClient,
): Promise<SignatureForged | null> {
    const client = getClient(supabase);
    const { data, error } = await client
        .from("forged_signatures")
        .select("*")
        .eq("id", id)
        .single();

    if (error) {
        console.error("Ошибка получения подписи:", error);
        return null;
    }
    return mapToSignatureForged(data);
}

export async function getUserGenuineSignatures(
    id: string,
    supabase?: SupabaseClient,
    userType: "user" | "pseudouser" = "user",
): Promise<SignatureGenuine[]> {
    const client = getClient(supabase);
    const { data, error } = await client
        .from("genuine_signatures")
        .select("*")
        .eq(userType === "user" ? "user_id" : "pseudouser_id", id);

    if (error) {
        console.error("Ошибка получения подписей:", error);
        return [];
    }
    return data.map(mapToSignatureGenuine);
}

export async function getUserForgedSignatures(
    id: string,
    supabase?: SupabaseClient,
    userType: "user" | "pseudouser" = "user",
): Promise<SignatureForged[]> {
    const client = getClient(supabase);
    const { data, error } = await client
        .from("forged_signatures")
        .select("*")
        .eq(userType === "user" ? "user_id" : "pseudouser_id", id);

    if (error) {
        console.error("Ошибка получения подделок:", error);
        return [];
    }
    return data.map(mapToSignatureForged);
}

export async function getGenuineSignaturesAmount(
    supabase?: SupabaseClient,
): Promise<number> {
    const client = getClient(supabase);

    const query = client
        .from("genuine_signatures")
        .select("id", { count: "exact", head: true });

    const { count, error } = await query;

    if (error) {
        console.error("Ошибка получения количества подписей:", error);
        return 0;
    }

    return count || 0;
}

export async function getForgedSignaturesAmount(
    supabase?: SupabaseClient,
): Promise<number> {
    const client = getClient(supabase);

    const query = client
        .from("forged_signatures")
        .select("id", { count: "exact", head: true });

    const { count, error } = await query;

    if (error) {
        console.error("Ошибка получения количества подделок:", error);
        return 0;
    }

    return count || 0;
}

// TODO: where profile/pseudouser, source for pseudouser
export async function getGenuineSignatures(
    supabase?: SupabaseClient,
    limit: number = 100,
    offset: number = 0,
): Promise<SignatureGenuine[]> {
    const client = getClient(supabase);
    const { data, error } = await client
        .from("genuine_signatures")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit)
        .range(offset, offset + limit - 1);

    if (error) {
        console.error("Ошибка получения подписей:", error);
        return [];
    }
    return data.map(mapToSignatureGenuine);
}

export async function getForgedSignatures(
    supabase?: SupabaseClient,
    limit: number = 100,
    offset: number = 0,
): Promise<SignatureForged[]> {
    const client = getClient(supabase);
    const { data, error } = await client
        .from("forged_signatures")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit)
        .range(offset, offset + limit - 1);

    if (error) {
        console.error("Ошибка получения подделок:", error);
        return [];
    }
    return data.map(mapToSignatureForged);
}

export async function profilesPrefixSearch(
    queryRaw: string,
    limit: number = 10,
    supabase?: SupabaseClient,
): Promise<Profile[]> {
    const query = (queryRaw || "").trim();
    if (!query) return [];

    const client = getClient(supabase);
    const prefixPattern = `${query}%`;

    const { data, error } = await client
        .from("profiles")
        .select("id, role, display_name, created_at, updated_at")
        .ilike("display_name", prefixPattern)
        .order("display_name", { ascending: true })
        .limit(limit);

    if (error) {
        console.error("Profiles prefix search error", error);
        return [];
    }
    return data.map(mapToProfile);
}

export async function pseudousersPrefixSearch(
    queryRaw: string,
    limit: number = 10,
    supabase?: SupabaseClient,
): Promise<Pseudouser[]> {
    const query = (queryRaw || "").trim();
    if (!query) return [];

    const client = getClient(supabase);
    const prefixPattern = `${query}%`;

    const { data, error } = await client
        .from("pseudousers")
        .select("*")
        .ilike("name", prefixPattern)
        .order("name", { ascending: true })
        .limit(limit);

    if (error) {
        console.error("Pseudousers prefix search error", error);
        return [];
    }
    return data.map(mapToPseudouser);
}

export async function profilesSubstrSearch(
    queryRaw: string,
    limit: number = 10,
    supabase?: SupabaseClient,
): Promise<Profile[]> {
    const query = (queryRaw || "").trim();
    if (!query) return [];

    const client = getClient(supabase);
    const prefixPattern = `${query}%`;
    const substrPattern = `%${query}%`;

    const { data, error } = await client
        .from("profiles")
        .select("id, role, display_name, created_at, updated_at")
        .ilike("display_name", substrPattern)
        .not("display_name", "ilike", prefixPattern)
        .order("display_name", { ascending: true })
        .limit(limit);

    if (error) {
        console.error("Profiles substr search error", error);
        return [];
    }
    return data.map(mapToProfile);
}

export async function pseudousersSubstrSearch(
    queryRaw: string,
    limit: number = 10,
    supabase?: SupabaseClient,
): Promise<Pseudouser[]> {
    const query = (queryRaw || "").trim();
    if (!query) return [];

    const client = getClient(supabase);
    const prefixPattern = `${query}%`;
    const substrPattern = `%${query}%`;

    const { data, error } = await client
        .from("pseudousers")
        .select("*")
        .ilike("name", substrPattern)
        .not("name", "ilike", prefixPattern)
        .order("name", { ascending: true })
        .limit(limit);

    if (error) {
        console.error("Pseudousers substr search error", error);
        return [];
    }
    return data.map(mapToPseudouser);
}

export async function getPseudouserByName(
    name: string,
    supabase?: SupabaseClient,
): Promise<Pseudouser | null> {
    const client = getClient(supabase);
    const { data, error } = await client
        .from("pseudousers")
        .select("*")
        .eq("name", name)
        .maybeSingle();

    if (error) {
        console.error("Pseudouser by name search error", error);
        return null;
    }
    return data ? mapToPseudouser(data) : null;
}

// ========================================
// INSERTS
// ========================================

export async function insertGenuineSignature(
    signature: SignatureGenuine,
    supabase?: SupabaseClient,
): Promise<boolean> {
    const client = getClient(supabase);
    const { error } = await client
        .from("genuine_signatures")
        .insert(signature);

    if (error) {
        console.error("Insert genuine signature error", error);
        return false;
    }

    return true;
}

export async function insertForgedSignature(
    signature: SignatureForged,
    supabase?: SupabaseClient,
): Promise<boolean> {
    const client = getClient(supabase);
    const { error } = await client
        .from("forged_signatures")
        .insert(signature);

    if (error) {
        console.error("Insert forged signature error", error);
        return false;
    }

    return true;
}

export async function insertPseudouser(
    pseudouser: { name: string, source: string },
    supabase?: SupabaseClient,
): Promise<Pseudouser | null> {
    const client = getClient(supabase);
    const { data, error } = await client
        .from("pseudousers")
        .insert({ name: pseudouser.name, source: pseudouser.source })
        .select("*")
        .single();

    if (error) {
        console.error("Insert pseudouser error", error);
        return null;
    }

    return mapToPseudouser(data);
}

// ========================================
// UPDATES
// ========================================

export async function updateUserForForgery(
    signatureId: string,
    userForForgery: boolean,
    supabase?: SupabaseClient,
): Promise<boolean> {
    const client = getClient(supabase);
    const { error } = await client
        .from("genuine_signatures")
        .update({ user_for_forgery: userForForgery })
        .eq("id", signatureId);

    if (error) {
        console.error("Update user_for_forgery error", error);
        return false;
    }

    return true;
}

export async function updateModForForgery(
    signatureId: string,
    modForForgery: boolean,
    supabase?: SupabaseClient,
): Promise<boolean> {
    const client = getClient(supabase);
    const { error } = await client
        .from("genuine_signatures")
        .update({ mod_for_forgery: modForForgery })
        .eq("id", signatureId);

    if (error) {
        console.error("Update mod_for_forgery error", error);
        return false;
    }

    return true;
}

export async function updateModForDataset(
    signatureId: string,
    modForDataset: boolean,
    supabase?: SupabaseClient,
    signatureType: "genuine" | "forged" = "genuine",
): Promise<boolean> {
    const client = getClient(supabase);
    const { error } = await client
        .from(signatureType === "genuine" ? "genuine_signatures" : "forged_signatures")
        .update({ mod_for_dataset: modForDataset })
        .eq("id", signatureId);

    if (error) {
        console.error("Update mod_for_dataset error", error);
        return false;
    }

    return true;
}

export async function updateAllUserForForgery(
    userId: string,
    userForForgery: boolean,
    supabase?: SupabaseClient,
    userType: "user" | "pseudouser" = "user",
    signatureType: "genuine" | "forged" = "genuine",
): Promise<boolean> {
    const client = getClient(supabase);
    const { error } = await client
        .from(signatureType === "genuine" ? "genuine_signatures" : "forged_signatures")
        .update({ user_for_forgery: userForForgery })
        .eq(userType === "user" ? "user_id" : "pseudouser_id", userId);

    if (error) {
        console.error("Update user_for_forgery error", error);
        return false;
    }

    return true;
}

export async function updateAllModForForgery(
    userId: string,
    modForForgery: boolean,
    supabase?: SupabaseClient,
    userType: "user" | "pseudouser" = "user",
    signatureType: "genuine" | "forged" = "genuine",
): Promise<boolean> {
    const client = getClient(supabase);
    const { error } = await client
        .from(signatureType === "genuine" ? "genuine_signatures" : "forged_signatures")
        .update({ mod_for_forgery: modForForgery })
        .eq(userType === "user" ? "user_id" : "pseudouser_id", userId);

    if (error) {
        console.error("Update mod_for_forgery error", error);
        return false;
    }

    return true;
}

export async function updateAllModForDataset(
    userId: string,
    modForDataset: boolean,
    supabase?: SupabaseClient,
    userType: "user" | "pseudouser" = "user",
    signatureType: "genuine" | "forged" = "genuine",
): Promise<boolean> {
    const client = getClient(supabase);
    const { error } = await client
        .from(signatureType === "genuine" ? "genuine_signatures" : "forged_signatures")
        .update({ mod_for_dataset: modForDataset })
        .eq(userType === "user" ? "user_id" : "pseudouser_id", userId);

    if (error) {
        console.error("Update mod_for_dataset error", error);
        return false;
    }

    return true;
}

// ========================================
// DELETES
// ========================================

export async function deleteSignature(
    signatureId: string,
    supabase?: SupabaseClient,
    signatureType: "genuine" | "forged" = "genuine",
): Promise<boolean> {
    const client = getClient(supabase);
    const { error } = await client
        .from(signatureType === "genuine" ? "genuine_signatures" : "forged_signatures")
        .delete()
        .eq("id", signatureId);

    if (error) {
        console.error("Delete signature error", error);
        return false;
    }

    return true;
}

// export async function getRecentSignatures(
//     supabase?: SupabaseClient,
//     limitPerType: number = 50,
// ): Promise<Signature[]> {
//     const genuine = await getGenuineSignatures(supabase, limitPerType, 0);
//     const forged = await getForgedSignatures(supabase, limitPerType, 0);
//     return [...genuine, ...forged];
// }