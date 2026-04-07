import type { APIRoute } from 'astro';
import { supabaseClient } from "../../../lib/supabase.js";

export const GET: APIRoute = async (context) => {
  const supabase = supabaseClient(context);
  const { data: courses, error } = await supabase
    .from('courses')
    .select(`
      id,
      name,
      location,
      tees (id, tee_name, color_code, rating, slope, par)
    `);
  if (error) {
    // Log the error for debugging
    console.error('Supabase error in /api/courses/list:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  return new Response(JSON.stringify({ courses }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
};
