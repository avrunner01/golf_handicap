import type { APIRoute } from "astro";
import { supabaseClient } from "../../../lib/supabase.js";

export const POST: APIRoute = async (context) => {
  const supabase = supabaseClient(context);
  const formData = await context.request.formData();

  const course_name = formData.get("course_name") as string;
  const tee_name = formData.get("tee_name") as string;
  const color_code = formData.get("color_code") as string;
  const rating = parseFloat(formData.get("rating") as string);
  const slope = parseInt(formData.get("slope") as string);
  const par = parseInt(formData.get("par") as string);

  // Insert course
  const { data: course, error: courseError } = await supabase
    .from("courses")
    .insert({ name: course_name })
    .select()
    .single();

  if (courseError || !course) {
    return new Response(courseError?.message || "Failed to add course", { status: 500 });
  }

  // Insert tee for the course
  const { error: teeError } = await supabase
    .from("tees")
    .insert({
      course_id: course.id,
      tee_name,
      color_code,
      rating,
      slope,
      par,
    });

  if (teeError) {
    return new Response(teeError.message, { status: 500 });
  }

  return context.redirect("/add-round");
};
