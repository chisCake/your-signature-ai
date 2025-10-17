import { createBrowserClient } from '@/lib/supabase/client';
import { Signature } from '@/lib/types';
import { getUserGenuineSignatures } from '@/lib/supabase/queries';

export async function getSignatures(): Promise<Signature[]> {
  try {
    const client = createBrowserClient();
    const { data } = await client.auth.getClaims();
    const userId = data?.claims?.sub;
    if (!userId) {
      throw new Error('User ID not found');
    }

    const signatures = await getUserGenuineSignatures(userId, client, 'user');
    return signatures;
  } catch (error) {
    console.error('Error getting signatures:', error);
    throw error;
  }
}
