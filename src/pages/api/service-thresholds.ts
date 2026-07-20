import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";
import { createServiceThresholdSchema } from "@/lib/schemas";
import { computeMileageBounds } from "@/lib/mileageValidation";
import type { ServiceThreshold } from "@/types";

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const user = context.locals.user;
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return Response.json({ error: "Supabase is not configured" }, { status: 500 });
  }

  let body: unknown;
  try {
    body = await context.request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const result = createServiceThresholdSchema.safeParse(body);
  if (!result.success) {
    const message = result.error.issues.map((e) => e.message).join(". ");
    return Response.json({ error: message }, { status: 400 });
  }

  const { data: car, error: carError } = await supabase
    .from("cars")
    .select("id, baseline_mileage")
    .eq("id", result.data.car_id)
    .eq("user_id", user.id)
    .single();

  if (carError) {
    return Response.json({ error: "Vehicle not found" }, { status: 404 });
  }

  if (result.data.last_performed_mileage !== undefined) {
    const baselineMileage = Number(car.baseline_mileage);
    if (result.data.last_performed_date !== undefined) {
      const { data: repairs, error: repairsError } = await supabase
        .from("repairs")
        .select("id, repair_date, mileage")
        .eq("car_id", result.data.car_id);
      if (repairsError) {
        return Response.json({ error: "Could not verify existing repairs, please try again" }, { status: 500 });
      }
      const bounds = computeMileageBounds(repairs, baselineMileage, result.data.last_performed_date);
      if (result.data.last_performed_mileage < bounds.min) {
        return Response.json(
          {
            error: `Last performed mileage must be at least ${bounds.min} km based on baseline mileage and logged repairs`,
          },
          { status: 400 },
        );
      }
      if (result.data.last_performed_mileage > bounds.max) {
        return Response.json(
          {
            error: `Last performed mileage must be at most ${bounds.max} km to stay consistent with a later repair already logged for this vehicle`,
          },
          { status: 400 },
        );
      }
    } else if (result.data.last_performed_mileage < baselineMileage) {
      return Response.json(
        { error: `Last performed mileage must be at least ${baselineMileage} km based on baseline mileage` },
        { status: 400 },
      );
    }
  }

  const { data: threshold, error } = (await supabase
    .from("service_thresholds")
    .insert({
      car_id: result.data.car_id,
      user_id: user.id,
      name: result.data.name,
      km_interval: result.data.km_interval ?? null,
      days_interval: result.data.days_interval ?? null,
      last_performed_date: result.data.last_performed_date ?? null,
      last_performed_mileage: result.data.last_performed_mileage ?? null,
    })
    .select()
    .single()) as { data: ServiceThreshold | null; error: { message: string } | null };

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json(threshold, { status: 201 });
};
