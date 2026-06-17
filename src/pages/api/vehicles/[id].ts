import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";

export const prerender = false;

export const DELETE: APIRoute = async (context) => {
  const user = context.locals.user;
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return Response.json({ error: "Supabase is not configured" }, { status: 500 });
  }

  const vehicleId = context.params.id;
  if (!vehicleId) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const { data: vehicle, error: vehicleError } = await supabase
    .from("cars")
    .select("id, user_id")
    .eq("id", vehicleId)
    .single();

  if (vehicleError || vehicle.user_id !== user.id) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { error } = await supabase.from("cars").delete().eq("id", vehicleId);

  if (error) {
    return Response.json({ error: "Something went wrong" }, { status: 500 });
  }

  return Response.json({ success: true });
};
