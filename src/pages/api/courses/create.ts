import type { APIRoute } from "astro";
import { supabaseClient } from "../../../lib/supabase.js";

const normalizeString = (value: unknown) => {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
};

const parseNumber = (value: unknown) => {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
};

const normalizeLocation = (value: unknown) => {
  if (!value) {
    return null;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  if (typeof value === "object") {
    const locationRecord = value as Record<string, unknown>;
    const parts = [
      normalizeString(locationRecord.city),
      normalizeString(locationRecord.state),
      normalizeString(locationRecord.country),
    ].filter(Boolean);

    if (parts.length > 0) {
      return parts.join(", ");
    }
  }

  return null;
};

const buildTees = (payload: Record<string, unknown>) => {
  const providedTees = Array.isArray(payload.tees) ? payload.tees : null;

  if (providedTees && providedTees.length > 0) {
    return providedTees
      .map((tee) => {
        if (!tee || typeof tee !== "object") {
          return null;
        }

        const teeRecord = tee as Record<string, unknown>;
        const tee_name = normalizeString(teeRecord.tee_name);
        const color_code = normalizeString(teeRecord.color_code) || tee_name;
        const rating = parseNumber(teeRecord.rating);
        const slope = parseNumber(teeRecord.slope);
        const par = parseNumber(teeRecord.par);

        if (!tee_name || rating === null || slope === null || par === null) {
          return null;
        }

        return {
          tee_name,
          color_code,
          rating,
          slope,
          par,
        };
      })
      .filter(Boolean);
  }

  const tee_name = normalizeString(payload.tee_name);
  const color_code = normalizeString(payload.color_code) || tee_name;
  const rating = parseNumber(payload.rating);
  const slope = parseNumber(payload.slope);
  const par = parseNumber(payload.par);

  if (!tee_name || rating === null || slope === null || par === null) {
    return [];
  }

  return [{ tee_name, color_code, rating, slope, par }];
};

const isJsonRequest = (request: Request) =>
  request.headers.get("content-type")?.includes("application/json") ?? false;

export const POST: APIRoute = async (context) => {
  const supabase = supabaseClient(context);
  const expectsJson = isJsonRequest(context.request);
  const payload = expectsJson
    ? ((await context.request.json()) as Record<string, unknown>)
    : Object.fromEntries(await context.request.formData());

  const course_name = normalizeString(payload.course_name);
  const location = normalizeLocation(payload.location);
  const tees = buildTees(payload);

  if (!course_name) {
    return new Response("Course name is required.", { status: 400 });
  }

  if (tees.length === 0) {
    return new Response("At least one tee is required.", { status: 400 });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return expectsJson
      ? new Response("You must be signed in to add a course.", { status: 401 })
      : context.redirect("/login?error=unauthorized");
  }

  const { data: existingCourses, error: existingCourseError } = await supabase
    .from("courses")
    .select("id, name")
    .eq("name", course_name)
    .limit(1);

  if (existingCourseError) {
    return new Response(existingCourseError.message, { status: 500 });
  }

  let course = existingCourses?.[0] ?? null;

  if (!course) {
    const { data: insertedCourse, error: courseError } = await supabase
      .from("courses")
      .insert({
        name: course_name,
        location,
      })
      .select("id, name")
      .single();

    if (courseError || !insertedCourse) {
      return new Response(courseError?.message || "Failed to add course", { status: 500 });
    }

    course = insertedCourse;
  }

  const { data: existingTees, error: existingTeesError } = await supabase
    .from("tees")
    .select("id, tee_name, rating, slope, par")
    .eq("course_id", course.id);

  if (existingTeesError) {
    return new Response(existingTeesError.message, { status: 500 });
  }

  const existingTeeKeys = new Map(
    (existingTees || []).map((tee) => [
      `${tee.tee_name}|${tee.rating}|${tee.slope}|${tee.par}`,
      tee.id,
    ])
  );

  const teeRows = tees.filter((tee, index, collection) => {
    const teeKey = `${tee.tee_name}|${tee.rating}|${tee.slope}|${tee.par}`;
    if (existingTeeKeys.has(teeKey)) {
      return false;
    }

    return collection.findIndex((candidate) =>
      candidate.tee_name === tee.tee_name
      && candidate.rating === tee.rating
      && candidate.slope === tee.slope
      && candidate.par === tee.par
    ) === index;
  });

  let insertedTees: Array<{ id: number }> = [];

  if (teeRows.length > 0) {
    const { data, error: teeError } = await supabase
      .from("tees")
      .insert(
        teeRows.map((tee) => ({
          course_id: course.id,
          tee_name: tee.tee_name,
          color_code: tee.color_code,
          rating: tee.rating,
          slope: tee.slope,
          par: tee.par,
        }))
      )
      .select("id");

    if (teeError) {
      return new Response(teeError.message, { status: 500 });
    }

    insertedTees = data || [];
  }

  const firstTee = tees[0];
  const firstTeeKey = `${firstTee.tee_name}|${firstTee.rating}|${firstTee.slope}|${firstTee.par}`;
  const selectedTeeId = insertedTees[0]?.id || existingTeeKeys.get(firstTeeKey) || null;

  if (expectsJson) {
    return new Response(
      JSON.stringify({
        courseId: course.id,
        selectedTeeId,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  return context.redirect("/add-round");
};
