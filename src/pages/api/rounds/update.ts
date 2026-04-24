import type { APIRoute } from 'astro';
import { supabaseClient, trySupabaseAdmin } from '../../../lib/supabase';
import { calculateHandicap } from '../../../lib/golfMath';

const getPostValueMap = async (request: Request) => {
  try {
    const formData = await request.formData();
    return Object.fromEntries(formData.entries());
  } catch {
    const rawBody = await request.text();
    const params = new URLSearchParams(rawBody);
    return Object.fromEntries(params.entries());
  }
};

const redirectToEdit = (id: string, errorMessage?: string) => {
  const params = new URLSearchParams();
  if (id) params.set('id', id);
  if (errorMessage) params.set('error', errorMessage);
  const query = params.toString();
  return new Response(null, {
    status: 303,
    headers: {
      Location: query ? `/edit-round?${query}` : '/edit-round',
    },
  });
};

const getTodayDateString = () => new Date().toISOString().split('T')[0];

export const POST: APIRoute = async (context) => {
  const supabase = supabaseClient(context);
  const supabaseWrite = trySupabaseAdmin();

  const postValues = await getPostValueMap(context.request);
  const idRaw = postValues.id;
  const grossScoreRaw = postValues.gross_score;
  const playedAtRaw = postValues.played_at;

  const id = typeof idRaw === 'string' ? idRaw.trim() : '';
  const gross_score = Number.parseInt(typeof grossScoreRaw === 'string' ? grossScoreRaw : '', 10);
  const played_at = typeof playedAtRaw === 'string' ? playedAtRaw.trim() : '';
  const today = getTodayDateString();

  if (!id || !Number.isFinite(gross_score) || !played_at) {
    return redirectToEdit(id, 'Please provide a valid score and date.');
  }

  if (played_at > today) {
    return redirectToEdit(id, 'Future rounds cannot be saved.');
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return context.redirect('/login');
  }

  if (!supabaseWrite) {
    return redirectToEdit(id, 'Server is missing SUPABASE_SERVICE_ROLE_KEY.');
  }

  const { data: existingRound, error: fetchError } = await supabase
    .from('rounds')
    .select('id, profile_id')
    .eq('id', id)
    .single();

  if (fetchError || !existingRound) {
    return redirectToEdit(id, 'Round not found.');
  }

  if (existingRound.profile_id !== user.id) {
    return redirectToEdit(id, 'You are not allowed to edit this round.');
  }

  const { error: updateError } = await (supabaseWrite as any)
    .from('rounds')
    .update({
      gross_score,
      played_at,
    })
    .eq('id', id)
    .eq('profile_id', user.id);

  if (updateError) {
    return redirectToEdit(id, updateError.message);
  }

  const { data: rounds, error: roundsError } = await (supabaseWrite as any)
    .from('rounds')
    .select('differential')
    .eq('profile_id', user.id);

  if (!roundsError && Array.isArray(rounds)) {
    const differentials = rounds
      .map((r) => (typeof r.differential === 'number' ? r.differential : Number(r.differential)))
      .filter((d) => !Number.isNaN(d));

    if (differentials.length > 0) {
      const newHandicap = calculateHandicap(differentials);
      await (supabaseWrite as any)
        .from('profiles')
        .update({ current_handicap_index: newHandicap, updated_at: new Date().toISOString() })
        .eq('id', user.id);
    }
  }

  return context.redirect('/dashboard');
};
