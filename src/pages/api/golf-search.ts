// src/pages/api/search.ts
import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ url }) => {
  const query = url.searchParams.get('q');
  const apiKey = import.meta.env.GOLF_COURSE_API_KEY;

  if (!query) {
    return new Response(JSON.stringify({ error: "Missing query" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  const response = await fetch(`https://api.golfcourseapi.com/v1/search?search_query=${query}`, {
    headers: { 'Authorization': `Key ${apiKey}` }
  });

  const data = await response.json();
  return new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json' }
  });
}