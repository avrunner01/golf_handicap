// src/pages/api/search.ts
import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ url }) => {
  const query = url.searchParams.get('q');
  const apiKey = import.meta.env.GOLF_COURSE_API_KEY ?? import.meta.env.PUBLIC_GOLF_COURSE_API_KEY;

  if (!query) {
    return new Response(JSON.stringify({ error: "Missing query" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  if (!apiKey) {
    return new Response(JSON.stringify({ error: "Golf course API key is not configured." }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }

  const response = await fetch(`https://api.golfcourseapi.com/v1/search?search_query=${query}`, {
    headers: { 'Authorization': `Key ${apiKey}` }
  });

  if (!response.ok) {
    const body = await response.text();
    return new Response(body || JSON.stringify({ error: "Golf course API request failed." }), {
      status: response.status,
      headers: { "Content-Type": "application/json" }
    });
  }

  const data = await response.json();
  return new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json' }
  });
}