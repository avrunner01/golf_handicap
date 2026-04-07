
import type { APIRoute } from "astro";
import { supabaseClient } from "../../../lib/supabase.js";
import { calculateHandicap } from "../../../lib/golfMath";

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

export const POST: APIRoute = async (context) => {
  const supabase = supabaseClient(context);
  const postValues = await getPostValueMap(context.request);

  const teeIdRaw = typeof postValues.tee_id === "string" ? postValues.tee_id : "";
  const grossScoreRaw = typeof postValues.gross_score === "string" ? postValues.gross_score : "";
  const playedAtRaw = typeof postValues.played_at === "string" ? postValues.played_at : "";

  const tee_id = teeIdRaw.trim();
  const gross_score = Number.parseInt(grossScoreRaw, 10);
  const played_at = playedAtRaw || new Date().toISOString().split("T")[0];

  if (!tee_id || !Number.isFinite(gross_score)) {
    return new Response("Invalid round submission.", { status: 400 });
  }

  // Fetch the course name for the selected tee
  let course_name = '';
  if (tee_id) {
    const { data: tee, error: teeError } = await supabase
      .from('tees')
      .select('tee_name, course_id')
      .eq('id', tee_id)
      .single();

    if (teeError) {
      return new Response(teeError.message, { status: 500 });
    }

    if (tee && tee.course_id) {
      const { data: course, error: courseError } = await supabase
        .from('courses')
        .select('name')
        .eq('id', tee.course_id)
        .single();

      if (courseError) {
        return new Response(courseError.message, { status: 500 });
      }

      course_name = course?.name || '';
    }
  }

  // Get current authenticated user from Supabase Auth service
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
    headers: { 'Location': '/dashboard' }
  });
  response.headers.append('Set-Cookie', 'handicapUpdated=1; Path=/; Max-Age=10');
  return response;
};