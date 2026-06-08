import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";
import { updateServiceThresholdSchema } from "@/lib/schemas";

export const prerender = false;

export const PUT: APIRoute = async (context) => {
  const user = context.locals.user;
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return Response.json({ error: "Supabase is not configured" }, { status: 500 });
  }

  const thresholdId = context.params.id;
  if (!thresholdId) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await context.request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const result = updateServiceThresholdSchema.safeParse(body);
  if (!result.success) {
    const message = result.error.issues.map((e) => e.message).join(". ");
    return Response.json({ error: message }, { status: 400 });
  }

  const updateData: Record<string, unknown> = {};
  if (result.data.name !== undefined) updateData.name = result.data.name;
  if (result.data.km_interval !== undefined) updateData.km_interval = result.data.km_interval;
  if (result.data.days_interval !== undefined) updateData.days_interval = result.data.days_interval;
  if (result.data.last_performed_date !== undefined) updateData.last_performed_date = result.data.last_performed_date;
  if (result.data.last_performed_mileage !== undefined)
    updateData.last_performed_mileage = result.data.last_performed_mileage;

  const { data: threshold, error } = await supabase
    .from("service_thresholds")
    .update(updateData)
    .eq("id", thresholdId)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error || !threshold) {
    return Response.json({ error: "Not found or forbidden" }, { status: 404 });
  }

  return Response.json(threshold);
};

export const DELETE: APIRoute = async (context) => {
  const user = context.locals.user;
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return Response.json({ error: "Supabase is not configured" }, { status: 500 });
  }

  const thresholdId = context.params.id;
  if (!thresholdId) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const { error } = await supabase
    .from("service_thresholds")
    .delete()
    .eq("id", thresholdId)
    .eq("user_id", user.id);

  if (error) {
    return Response.json({ error: "Something went wrong" }, { status: 500 });
  }

  return new Response(null, { status: 204 });
};
