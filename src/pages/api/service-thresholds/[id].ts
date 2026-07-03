import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";
import { updateServiceThresholdSchema } from "@/lib/schemas";
import { computeMileageBounds } from "@/lib/mileageValidation";
import type { ServiceThreshold } from "@/types";

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

  const { data: existing, error: fetchError } = await supabase
    .from("service_thresholds")
    .select("id, user_id, car_id, last_performed_date, last_performed_mileage")
    .eq("id", thresholdId)
    .single();

  if (fetchError) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  // Ownership is also enforced by RLS UPDATE policy; app-layer check is belt-and-suspenders.
  if (existing.user_id !== user.id) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const result = updateServiceThresholdSchema.safeParse(body);
  if (!result.success) {
    const message = result.error.issues.map((e) => e.message).join(". ");
    return Response.json({ error: message }, { status: 400 });
  }

  const effectiveMileage: number | null | undefined =
    result.data.last_performed_mileage !== undefined
      ? result.data.last_performed_mileage
      : (existing.last_performed_mileage as number | null);
  const effectiveDate: string | null | undefined =
    result.data.last_performed_date !== undefined
      ? result.data.last_performed_date
      : (existing.last_performed_date as string | null);

  if (typeof effectiveMileage === "number") {
    const { data: car, error: carError } = await supabase
      .from("cars")
      .select("baseline_mileage")
      .eq("id", existing.car_id as string)
      .single();

    if (carError) {
      return Response.json({ error: "Vehicle not found" }, { status: 404 });
    }

    const baselineMileage = Number(car.baseline_mileage);

    if (typeof effectiveDate === "string") {
      const { data: repairs, error: repairsError } = await supabase
        .from("repairs")
        .select("id, repair_date, mileage")
        .eq("car_id", existing.car_id as string);
      if (repairsError) {
        return Response.json({ error: "Could not verify existing repairs, please try again" }, { status: 500 });
      }
      const bounds = computeMileageBounds(repairs, baselineMileage, effectiveDate);
      if (effectiveMileage < bounds.min) {
        return Response.json(
          {
            error: `Last performed mileage must be at least ${bounds.min} km based on baseline mileage and logged repairs`,
          },
          { status: 400 },
        );
      }
      if (effectiveMileage > bounds.max) {
        return Response.json(
          {
            error: `Last performed mileage must be at most ${bounds.max} km to stay consistent with a later repair already logged for this vehicle`,
          },
          { status: 400 },
        );
      }
    } else if (effectiveMileage < baselineMileage) {
      return Response.json(
        { error: `Last performed mileage must be at least ${baselineMileage} km based on baseline mileage` },
        { status: 400 },
      );
    }
  }

  const updateData: Record<string, unknown> = {};
  if (result.data.name !== undefined) updateData.name = result.data.name;
  if (result.data.km_interval !== undefined) updateData.km_interval = result.data.km_interval;
  if (result.data.days_interval !== undefined) updateData.days_interval = result.data.days_interval;
  if (result.data.last_performed_date !== undefined) updateData.last_performed_date = result.data.last_performed_date;
  if (result.data.last_performed_mileage !== undefined)
    updateData.last_performed_mileage = result.data.last_performed_mileage;

  const { data: threshold, error } = (await supabase
    .from("service_thresholds")
    .update(updateData)
    .eq("id", thresholdId)
    .eq("user_id", user.id)
    .select()
    .single()) as { data: ServiceThreshold | null; error: { message: string } | null };

  if (error) {
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

  const { data: existing, error: fetchError } = await supabase
    .from("service_thresholds")
    .select("id, user_id")
    .eq("id", thresholdId)
    .single();

  if (fetchError) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  // Ownership is also enforced by RLS DELETE policy; app-layer check is belt-and-suspenders.
  if (existing.user_id !== user.id) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { error } = await supabase.from("service_thresholds").delete().eq("id", thresholdId);

  if (error) {
    return Response.json({ error: "Something went wrong" }, { status: 500 });
  }

  return new Response(null, { status: 204 });
};
