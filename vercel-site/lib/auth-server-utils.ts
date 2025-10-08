import { createServerClient } from "@/lib/supabase/server";
import { hasRole } from "@/lib/auth-utils";
import { getProfile, getGenuineSignature } from "@/lib/supabase/queries";
import { SignatureGenuine } from "@/lib/types";

export async function getUser() {
    const supabase = await createServerClient();
    const { data } = await supabase.auth.getClaims();
    // console.log("getUser (server):", data?.claims);
    return data?.claims;
}

export async function isMod(user: any = null) {
    return hasRole(user || await getUser(), "mod");
};

export async function isAdmin(user: any = null) {
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
    if (user?.sub === targetSignature.user_id)
        return true;

    const targetUser = await getProfile(targetSignature.user_id);
    const targetUserRole = targetUser?.role;

    // For admin
    if (await isAdmin(user)) {
        if (user?.sub === targetSignature.user_id)
            return true;

        if (targetUserRole === "admin")
            return false;
        return true;
    }

    // For mod
    if (await isMod(user)) {
        if (targetUserRole === "mod" || targetUserRole === "admin")
            return false;
        return true;
    }

    console.warn(`Unpredicted situation: user ${user?.sub} cannot edit signature ${signatureId}`);
    return false;
}
