import type { APIRoute } from 'astro';
import { supabaseClient } from '../../lib/supabase';
import { calculateHandicap } from '../../lib/golfMath';

export const POST: APIRoute = async ({ request, redirect }) => {
  const formData = await request.formData();
  
  // 1. Extract and parse data
    const gross_score = parseInt(formData.get('gross_score') as string);
  const rating = parseFloat(formData.get('rating') as string);
  const slope = parseInt(formData.get('slope') as string);
  const course = formData.get('course') as string;
  
  const context = { request, redirect };
  const supabase = supabaseClient(context);

  // TODO: Get actual user ID from session
  const userId = 'user-uuid-from-auth'; // Replace with actual user id

  // TODO: Get profile id for the user
  const profileId = userId; // If profile id is same as user id

  // 2. Insert the new round
  const { error: insertError } = await supabase
    .from('rounds')
    .insert([{ 
        profile_id: profileId, 
        gross_score, 
        course_rating: rating, 
        slope_rating: slope, 
        course_name: course 
    }]);

  if (insertError) return new Response(insertError.message, { status: 500 });

  // 3. Recalculate Handicap Index
  const { data: rounds } = await supabase
    .from('rounds')
    .select('differential')
    .eq('profile_id', profileId)
    .order('date', { ascending: false })
    .limit(20);

  if (rounds) {
    const newHandicap = calculateHandicap(rounds.map((r: { differential: number }) => r.differential));
    await supabase
      .from('profiles')
      .update({ handicap_index: newHandicap })
      .eq('id', userId);
  }

  return redirect('/dashboard?success=true');
};