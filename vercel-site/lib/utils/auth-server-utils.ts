import { createServerClient } from '@/lib/supabase/server';
import { hasRole } from '@/lib/utils/auth-utils';
import { getProfile, getGenuineSignature } from '@/lib/supabase/queries';
import { SignatureGenuine, Profile } from '@/lib/types';

export async function getUser() {
  const supabase = await createServerClient();
  const { data, error } = await supabase.auth.getClaims();
  
  if (error) {
    console.warn('[getUser] Error getting user claims:', error);
    return null;
  }
  
  return data?.claims;
}

export async function getUserProfile(): Promise<Profile | null> {
  try {
    const user = await getUser();
    if (!user?.sub) {
      return null;
    }

    const supabase = await createServerClient();
    const profile = await getProfile(user.sub, supabase);
    
    if (!profile) {
      return null;
    }

    // Добавляем email из claims
    profile.email = user.email || null;
    
    return profile;
  } catch (error) {
    console.warn('[getUserProfile] Error getting user profile:', error);
    return null;
  }
}

export async function isMod(user: unknown = null) {
  const userToCheck = user || (await getUser());
  const result = hasRole(userToCheck, 'mod');
  return result;
}

export async function isAdmin(user: unknown = null) {
  const userToCheck = user || (await getUser());
  const result = hasRole(userToCheck, 'admin');
  return result;
}

export async function canEditSignature(
  signature: SignatureGenuine | null = null,
  signatureId: string | null = null
): Promise<boolean> {
  let targetSignature = signature;

  if (!signatureId && !signature) {
    console.warn('[canEditSignature] Neither signatureId nor signature provided');
    return false;
  }

  if (signatureId) {
    targetSignature = await getGenuineSignature(signatureId);
  }
  // else signature is already provided

  if (!targetSignature) {
    console.warn('[canEditSignature] Signature not found for ID:', signatureId);
    return false;
  }

  if (targetSignature.pseudouser_id) {
    return true;
  }

  const user = await getUser();

  // For owner
  if (user?.sub === targetSignature.user_id) {
    return true;
  }

  if (!targetSignature.user_id) {
    console.warn('[canEditSignature] targetSignature.user_id is undefined');
    return false;
  }
  const targetUser = await getProfile(targetSignature.user_id);
  const targetUserRole = targetUser?.role;

  // For admin
  if (await isAdmin(user)) {
    if (user?.sub === targetSignature.user_id) {
      return true;
    }

    if (targetUserRole === 'admin') {
      return false;
    }
    return true;
  }

  // For mod
  if (await isMod(user)) {
    if (targetUserRole === 'mod' || targetUserRole === 'admin') {
      return false;
    }
    return true;
  }

  return false;
}
