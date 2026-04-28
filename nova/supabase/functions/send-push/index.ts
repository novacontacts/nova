import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type' } });
  }

  const { household_id, excluded_user_id, title, body } = await req.json();

  if (!household_id || !excluded_user_id || !title || !body) {
    return new Response(JSON.stringify({ error: 'Saknade fält' }), { status: 400 });
  }

  // Hämta push-token för alla hushållsmedlemmar utom avsändaren
  const { data: members } = await supabase
    .from('household_members')
    .select('user_id, profile:profiles(push_token)')
    .eq('household_id', household_id)
    .neq('user_id', excluded_user_id);

  const tokens: string[] = (members ?? [])
    .map((m: any) => m.profile?.push_token)
    .filter(Boolean);

  if (tokens.length === 0) {
    return new Response(JSON.stringify({ sent: 0 }), { status: 200 });
  }

  // Skicka via Expo Push API
  const messages = tokens.map((token) => ({
    to: token,
    title,
    body,
    sound: 'default',
    data: { household_id },
  }));

  const res = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(messages),
  });

  const result = await res.json();
  return new Response(JSON.stringify({ sent: tokens.length, result }), {
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
});
