import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { createLoginVerifier } from '../src/verify-login.mjs';

const config = JSON.parse(readFileSync(new URL('../aleph.config.json', import.meta.url), 'utf8'));
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  const id = request.query?.id;
  const isItem = typeof id === 'string';
  const methods = isItem ? ['GET', 'PUT', 'DELETE'] : ['GET', 'POST'];
  if (!methods.includes(request.method)) {
    response.setHeader('Allow', methods.join(', '));
    return response.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  }
  if ((id !== undefined && (!isItem || !uuidPattern.test(id)))) {
    return response.status(400).json({ error: 'INVALID_ID' });
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
  if (!verified) return response.status(401).json({ error: 'UNAUTHORIZED' });

  const supabase = createClient(supabaseUrl, supabaseSecretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  });
  const table = supabase.from('notes');
  const fields = 'id, title, content, owner_id, created_at';
  const out = note => ({ id: note.id, title: note.title, body: note.content });

  if (request.method === 'GET' && !isItem) {
    const { data, error } = await table.select(fields)
      .eq('owner_id', verified.userId).order('created_at', { ascending: true });
    if (error) return response.status(500).json({ error: 'NOTES_READ_FAILED' });
    return response.status(200).json({ notes: data.map(out) });
  }

  if (request.method === 'POST') {
    const body = request.body ?? {};
    const noteId = body.id === undefined || body.id === null ? randomUUID() : body.id;
    if (!uuidPattern.test(noteId) || typeof body.title !== 'string' || !body.title.trim()
        || typeof body.body !== 'string') {
      return response.status(400).json({ error: 'INVALID_NOTE' });
    }
    const { error } = await table.insert({
      id: noteId, title: body.title, content: body.body, owner_id: verified.userId
    });
    if (error) return response.status(500).json({ error: 'NOTES_WRITE_FAILED' });
    return response.status(201).json({ id: noteId });
  }

  if (request.method === 'GET') {
    // Stage 3 intentionally does not enforce owner_id on item access.
    const { data, error } = await table.select(fields).eq('id', id).maybeSingle();
    if (error) return response.status(500).json({ error: 'NOTES_READ_FAILED' });
    if (!data) return response.status(404).json({ error: 'NOT_FOUND' });
    return response.status(200).json(out(data));
  }

  if (request.method === 'PUT') {
    const body = request.body ?? {};
    if (typeof body.title !== 'string' || !body.title.trim() || typeof body.body !== 'string') {
      return response.status(400).json({ error: 'INVALID_NOTE' });
    }
    const { data, error } = await table.update({
      title: body.title, content: body.body
    }).eq('id', id).select('id').maybeSingle();
    if (error) return response.status(500).json({ error: 'NOTES_WRITE_FAILED' });
    if (!data) return response.status(404).json({ error: 'NOT_FOUND' });
    return response.status(200).json({ id });
  }

  const { data, error } = await table.delete().eq('id', id).select('id').maybeSingle();
  if (error) return response.status(500).json({ error: 'NOTES_DELETE_FAILED' });
  if (!data) return response.status(404).json({ error: 'NOT_FOUND' });
  return response.status(200).json({ id });
}
