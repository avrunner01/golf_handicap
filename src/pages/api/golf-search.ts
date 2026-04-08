// src/pages/api/search.ts
import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ url }) => {
  const query = (url.searchParams.get('q') || '').trim();
  const apiKey = import.meta.env.GOLF_COURSE_API_KEY || import.meta.env.GOLF_API_KEY;

  if (!query) {
    return new Response(JSON.stringify({ error: "Missing query" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'Server missing golf API key configuration.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  let response: Response;
  try {
    response = await fetch(`https://api.golfcourseapi.com/v1/search?search_query=${encodeURIComponent(query)}`, {
      headers: { 'Authorization': `Key ${apiKey}` }
    });
  } catch {
    return new Response(JSON.stringify({ error: 'Unable to reach golf search provider.' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const raw = await response.text();
  let data: any = {};

  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    data = {};
  }

  if (!response.ok) {
    const message = data?.error || data?.message || `Golf search provider error (${response.status}).`;
    return new Response(JSON.stringify({ error: message }), {
      status: response.status,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  return new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json' }
  });
}