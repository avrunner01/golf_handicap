// src/pages/api/search.ts
import type { APIRoute } from 'astro';

const normalizeApiKey = (value: unknown) => {
  if (typeof value !== 'string') {
    return '';
  }

  return value.trim().replace(/^['\"]+|['\"]+$/g, '');
};

const resolveGolfApiKey = () => {
  const candidates = [
    import.meta.env.GOLF_COURSE_API_KEY,
    import.meta.env.GOLF_API_KEY,
    process.env.GOLF_COURSE_API_KEY,
    process.env.GOLF_API_KEY,
  ];

  for (const candidate of candidates) {
    const normalized = normalizeApiKey(candidate);
    if (normalized.length > 0) {
      return normalized;
    }
  }

  return '';
};

const resolveRapidApiKey = () => {
  const candidates = [
    import.meta.env.RAPIDAPI_KEY,
    import.meta.env.X_RAPIDAPI_KEY,
    process.env.RAPIDAPI_KEY,
    process.env.X_RAPIDAPI_KEY,
  ];

  for (const candidate of candidates) {
    const normalized = normalizeApiKey(candidate);
    if (normalized.length > 0) {
      return normalized;
    }
  }

  return '';
};

const resolveRapidApiHost = () => {
  const candidates = [
    import.meta.env.RAPIDAPI_HOST,
    import.meta.env.X_RAPIDAPI_HOST,
    process.env.RAPIDAPI_HOST,
    process.env.X_RAPIDAPI_HOST,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim().length > 0) {
      return candidate.trim();
    }
  }

  return 'golf-course-api.p.rapidapi.com';
};

const normalizeRapidApiHost = (host: string) => {
  return host.replace(/^https?:\/\//i, '').replace(/\/$/, '');
};

const pickRateLimitInfo = (headers: Headers) => ({
  limit: headers.get('x-ratelimit-limit') || headers.get('ratelimit-limit') || null,
  remaining: headers.get('x-ratelimit-remaining') || headers.get('ratelimit-remaining') || null,
  reset: headers.get('x-ratelimit-reset') || headers.get('ratelimit-reset') || null,
});

export const GET: APIRoute = async ({ url }) => {
  const query = (url.searchParams.get('q') || '').trim();
  const courseId = (url.searchParams.get('id') || '').trim();
  const apiKey = resolveGolfApiKey();
  const rapidApiKey = resolveRapidApiKey();
  const rapidApiHost = normalizeRapidApiHost(resolveRapidApiHost());

  if (!query && !courseId) {
    return new Response(JSON.stringify({ error: "Missing query or course id" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  if (!apiKey && !rapidApiKey) {
    return new Response(JSON.stringify({ error: 'Server missing golf API key configuration.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const fetchProvider = async (path: string) => {
    const attempts: Array<{ url: string; headers: Record<string, string>; authMode: string }> = [];

    if (apiKey) {
      attempts.push({
        url: `https://api.golfcourseapi.com${path}`,
        headers: { Authorization: `Bearer ${apiKey}` },
        authMode: 'authorization-bearer',
      });
      attempts.push({
        url: `https://api.golfcourseapi.com${path}`,
        headers: { Authorization: `Key ${apiKey}` },
        authMode: 'authorization-key',
      });
      attempts.push({
        url: `https://api.golfcourseapi.com${path}`,
        headers: { Authorization: apiKey },
        authMode: 'authorization-raw',
      });
      attempts.push({
        url: `https://api.golfcourseapi.com${path}`,
        headers: { 'x-api-key': apiKey },
        authMode: 'x-api-key',
      });
    }

    if (rapidApiKey) {
      attempts.push({
        url: `https://${rapidApiHost}${path}`,
        headers: {
          'x-rapidapi-key': rapidApiKey,
          'x-rapidapi-host': rapidApiHost,
        },
        authMode: 'x-rapidapi-key',
      });
    }

    let lastFailure = {
      status: 502,
      data: { error: 'Unable to reach golf search provider.' },
      authMode: 'none',
      rateLimit: { limit: null, remaining: null, reset: null },
    };

    for (const attempt of attempts) {
      try {
        const response = await fetch(attempt.url, {
          headers: attempt.headers,
        });

        const raw = await response.text();
        let data: any = {};

        try {
          data = raw ? JSON.parse(raw) : {};
        } catch {
          data = {};
        }

        if (response.ok) {
          return {
            ok: true,
            status: response.status,
            data,
            authMode: attempt.authMode,
            rateLimit: pickRateLimitInfo(response.headers),
          };
        }

        lastFailure = {
          status: response.status,
          data,
          authMode: attempt.authMode,
          rateLimit: pickRateLimitInfo(response.headers),
        };
      } catch {
        lastFailure = {
          status: 502,
          data: { error: 'Unable to reach golf search provider.' },
          authMode: attempt.authMode,
          rateLimit: { limit: null, remaining: null, reset: null },
        };
      }
    }

    return {
      ok: false,
      status: lastFailure.status,
      data: lastFailure.data,
      authMode: lastFailure.authMode,
      rateLimit: lastFailure.rateLimit,
    };
  };

  if (courseId) {
    const attempts = [
      `/v1/courses/${encodeURIComponent(courseId)}`,
      `/v1/course/${encodeURIComponent(courseId)}`,
      `/v1/courses?id=${encodeURIComponent(courseId)}`,
      `/v1/search?search_query=${encodeURIComponent(courseId)}`,
    ];

    let lastFailure: { status: number; authMode?: string; rateLimit?: { limit: string | null; remaining: string | null; reset: string | null }; data?: any } | null = null;

    for (const path of attempts) {
      const result = await fetchProvider(path);

      if (!result.ok) {
        lastFailure = result;
        continue;
      }

      const data = result.data;
      const candidates = [
        data?.course,
        data?.data,
        ...(Array.isArray(data?.courses) ? data.courses : []),
        ...(Array.isArray(data?.data) ? data.data : []),
      ].filter(Boolean);

      const matchedCourse = candidates.find((candidate: any) =>
        String(candidate?.id ?? '') === courseId
      ) || candidates[0];

      if (matchedCourse) {
        return new Response(JSON.stringify({ course: matchedCourse }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    if (lastFailure && (lastFailure.status === 401 || lastFailure.status === 403)) {
      return new Response(JSON.stringify({
        error: 'Golf provider rejected API credentials. Verify API key format, plan permissions, and request quota.',
        providerStatus: lastFailure.status,
        providerAuthMode: lastFailure.authMode || 'unknown',
        providerRateLimit: lastFailure.rateLimit || { limit: null, remaining: null, reset: null },
      }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ error: 'Could not load full course details from provider.' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const result = await fetchProvider(`/v1/search?search_query=${encodeURIComponent(query)}`);
  const data = result.data;

  if (!result.ok) {
    const message = data?.error || data?.message || `Golf search provider error (${result.status}).`;

    if (result.status === 401 || result.status === 403) {
      return new Response(JSON.stringify({
        error: 'Golf provider rejected API credentials. Verify API key format, plan permissions, and request quota.',
        providerStatus: result.status,
        providerAuthMode: result.authMode,
        providerRateLimit: result.rateLimit,
      }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({
      error: message,
      providerStatus: result.status,
      providerAuthMode: result.authMode,
      providerRateLimit: result.rateLimit,
    }), {
      status: result.status,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  return new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json' }
  });
}