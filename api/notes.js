import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { createLoginVerifier } from '../src/verify-login.mjs';

const config = JSON.parse(readFileSync(new URL('../aleph.config.json', import.meta.url), 'utf8'));

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');

  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return response.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;
  if (!supabaseUrl || !supabaseSecretKey) {
    return response.status(500).json({ error: 'SERVER_CONFIGURATION_MISSING' });
  }

  let verified;
  try {
    const verifyLogin = createLoginVerifier({ config, supabaseSecretKey });
    verified = await verifyLogin(request.headers.authorization);
  } catch {
    return response.status(500).json({ error: 'LOGIN_VERIFIER_UNAVAILABLE' });
  }

  if (!verified) {
    return response.status(401).json({ error: 'UNAUTHORIZED' });
  }

  const supabase = createClient(supabaseUrl, supabaseSecretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  });

  const { data, error } = await supabase
    .from('notes')
    .select('title, content')
    .order('created_at', { ascending: true });

  if (error) {
    return response.status(500).json({ error: 'NOTES_READ_FAILED' });
  }

  return response.status(200).json({ notes: data });
}
