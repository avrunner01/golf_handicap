
import type { APIRoute } from "astro";
import { supabaseClient } from "../../../lib/supabase.js";
import { calculateHandicap } from "../../../lib/golfMath";

export const POST: APIRoute = async (context) => {
  const supabase = supabaseClient(context);
  const formData = await context.request.formData();
  
  const tee_id = formData.get("tee_id");
  const gross_score = parseInt(formData.get("gross_score") as string);
  const played_at = formData.get("played_at");

  // Fetch the course name for the selected tee
  let course_name = '';
  if (tee_id) {
    const { data: tee, error: teeError } = await supabase
      .from('tees')
      .select('tee_name, course_id')
      .eq('id', tee_id)
      .single();
    if (tee && tee.course_id) {
      const { data: course } = await supabase
        .from('courses')
        .select('name')
        .eq('id', tee.course_id)
        .single();
      course_name = course?.name || '';
    }
  }

  // Get current user
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return context.redirect("/login");

  const { error } = await supabase.from("rounds").insert({
    profile_id: user.id,
    tee_id,
    gross_score,
    played_at,
    course_name,
  });

  if (error) {
    return new Response(error.message, { status: 500 });
  }

  // Fetch all differentials for this user
  const { data: rounds, error: roundsError } = await supabase
    .from("rounds")
    .select("differential")
    .eq("profile_id", user.id);

  if (!roundsError && Array.isArray(rounds)) {
    // Only use valid number differentials
    const differentials = rounds
      .map(r => typeof r.differential === 'number' ? r.differential : Number(r.differential))
      .filter(d => !isNaN(d));
    if (differentials.length > 0) {
      const newHandicap = calculateHandicap(differentials);
      await supabase
        .from("profiles")
        .update({ current_handicap_index: newHandicap, updated_at: new Date().toISOString() })
        .eq("id", user.id);
    }
  }

  // Set a sessionStorage flag for the home page update message
  const response = new Response(null, {
    status: 303,
    headers: { 'Location': '/' }
  });
  response.headers.append('Set-Cookie', 'handicapUpdated=1; Path=/; Max-Age=10');
  return response;
};