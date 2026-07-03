import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";
import { updateRepairSchema, categoryOverrideSchema } from "@/lib/schemas";
import { classifyRepair } from "@/lib/classifyRepair";
import { computeMileageBounds } from "@/lib/mileageValidation";

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

  const repairId = context.params.id;
  if (!repairId) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const { data: repair, error: repairError } = await supabase
    .from("repairs")
    .select("id, user_id, car_id, description, category, category_source")
    .eq("id", repairId)
    .single();

  if (repairError || repair.user_id !== user.id) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: car, error: carError } = await supabase
    .from("cars")
    .select("baseline_mileage")
    .eq("id", repair.car_id)
    .single();

  if (carError) {
    return Response.json({ error: "Vehicle not found" }, { status: 404 });
  }

  const { data: siblingRepairs, error: siblingsError } = await supabase
    .from("repairs")
    .select("id, repair_date, mileage")
    .eq("car_id", repair.car_id);

  if (siblingsError) {
    return Response.json({ error: "Could not verify existing repairs, please try again" }, { status: 500 });
  }

  let body: unknown;
  try {
    body = await context.request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const result = updateRepairSchema.safeParse(body);
  if (!result.success) {
    const message = result.error.issues.map((e) => e.message).join(". ");
    return Response.json({ error: message }, { status: 400 });
  }

  const bounds = computeMileageBounds(siblingRepairs, Number(car.baseline_mileage), result.data.repair_date, repairId);
  if (result.data.mileage < bounds.min) {
    return Response.json(
      { error: `Mileage must be at least ${bounds.min} km based on baseline mileage and previously logged repairs` },
      { status: 400 },
    );
  }
  if (result.data.mileage > bounds.max) {
    return Response.json(
      {
        error: `Mileage must be at most ${bounds.max} km to stay consistent with a later repair already logged for this vehicle`,
      },
      { status: 400 },
    );
  }

  const updateData: Record<string, unknown> = {
    repair_date: result.data.repair_date,
    description: result.data.description,
    cost: result.data.cost ?? null,
    mileage: result.data.mileage,
  };

  const descriptionChanged = result.data.description !== repair.description;
  const needsClassification = repair.category == null || (descriptionChanged && repair.category_source !== "manual");

  if (needsClassification) {
    const classified = await classifyRepair(result.data.description);
    updateData.category = classified ?? "pending";
    updateData.category_source = classified ? "ai" : "pending";
    updateData.original_category = updateData.category;
  }

  // Ownership is also enforced by RLS UPDATE policy; app-layer check above is belt-and-suspenders.
  const { error } = await supabase.from("repairs").update(updateData).eq("id", repairId);

  if (error) {
    return Response.json({ error: "Something went wrong" }, { status: 500 });
  }

  return Response.json({ success: true });
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

  const repairId = context.params.id;
  if (!repairId) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const { data: repair, error: repairError } = await supabase
    .from("repairs")
    .select("id, user_id")
    .eq("id", repairId)
    .single();

  if (repairError || repair.user_id !== user.id) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  // Ownership is also enforced by RLS DELETE policy; app-layer check above is belt-and-suspenders.
  const { error } = await supabase.from("repairs").delete().eq("id", repairId);

  if (error) {
    return Response.json({ error: "Something went wrong" }, { status: 500 });
  }

  return Response.json({ success: true });
};

export const PATCH: APIRoute = async (context) => {
  const user = context.locals.user;
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return Response.json({ error: "Supabase is not configured" }, { status: 500 });
  }

  const repairId = context.params.id;
  if (!repairId) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const { data: repair, error: repairError } = await supabase
    .from("repairs")
    .select("id, user_id")
    .eq("id", repairId)
    .single();

  if (repairError || repair.user_id !== user.id) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await context.request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const result = categoryOverrideSchema.safeParse(body);
  if (!result.success) {
    const message = result.error.issues.map((e) => e.message).join(". ");
    return Response.json({ error: message }, { status: 400 });
  }

  const { error } = await supabase
    .from("repairs")
    .update({
      category: result.data.category,
      category_source: "manual",
    })
    .eq("id", repairId);

  if (error) {
    return Response.json({ error: "Something went wrong" }, { status: 500 });
  }

  return Response.json({ success: true });
};
