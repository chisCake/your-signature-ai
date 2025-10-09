import { createBrowserClient } from "@/lib/supabase/client";
import { hasRole } from "@/lib/auth-utils";
import { getProfile, getGenuineSignature } from "@/lib/supabase/queries";
import { SignatureGenuine } from "@/lib/types";

export async function getUser() {
    const supabase = createBrowserClient();
    const { data: sessionData } = await supabase.auth.getSession();
    const sessionUser = sessionData?.session?.user;
    if (!sessionUser) return null;
    // console.log("getUser (client):", sessionUser);
    return sessionUser;
}

export async function isMod(user: unknown = null) {
    return hasRole(user || await getUser(), "mod");
};

export async function isAdmin(user: unknown = null) {
    return hasRole(user || await getUser(), "admin");
};

export async function canEditSignature(signature: SignatureGenuine | null = null, signatureId: string | null = null): Promise<boolean> {
    let targetSignature = signature;
  
    if (!signatureId && !signature) {
      console.error("Neither signatureId nor signature provided");
      return false;
    }
  
    if (signatureId) {
      targetSignature = await getGenuineSignature(signatureId);
    }
    // else signature is already provided
  
    if (!targetSignature) {
      console.error(`Signature not found ${signatureId}`);
      return false;
    }

    if (!targetSignature.user_id) {
        console.error(`Signature has no user_id ${signatureId}`);
        return false;
    }
  
    const user = await getUser();
    
    // For owner
    if (user?.id === targetSignature.user_id)
        return true;

    const targetUser = await getProfile(targetSignature.user_id);
    const targetUserRole = targetUser?.role;

    // For admin
    if (await isAdmin(user)) {
        return targetUserRole !== "admin";
    }

    // For mod
    if (await isMod(user)) {
        return targetUserRole !== "mod" && targetUserRole !== "admin";
    }

    console.warn(`Unpredicted situation: user ${user?.id} cannot edit signature ${signatureId}`);
    return false;
}
