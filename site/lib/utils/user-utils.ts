import { createBrowserClient } from '@/lib/supabase/client';
import { getUserGenuineSignatures } from '@/lib/supabase/queries';
import { SignatureGenuine } from '@/lib/types';

export async function getGenuineSignatures(): Promise<SignatureGenuine[]> {
  try {
    const client = createBrowserClient();
    const { data } = await client.auth.getClaims();
    const userId = data?.claims?.sub;
    if (!userId) {
      throw new Error('User ID not found');
    }

    const signatures = await getUserGenuineSignatures(userId, 'user', client);
    return signatures;
  } catch (error) {
    console.error('Error getting signatures:', error);
    throw error;
  }
}
