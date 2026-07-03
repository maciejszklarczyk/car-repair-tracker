import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";
import { createRepairSchema } from "@/lib/schemas";
import { classifyRepair } from "@/lib/classifyRepair";
import { computeMileageBounds } from "@/lib/mileageValidation";

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const user = context.locals.user;
  if (!user) {
    return context.redirect("/auth/signin");
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return context.redirect(`/dashboard/vehicles?error=${encodeURIComponent("Supabase is not configured")}`);
  }

  const form = await context.request.formData();
  const carId = form.get("car_id") as string;

  const { data: car, error: carError } = await supabase
    .from("cars")
    .select("id, user_id, baseline_mileage")
    .eq("id", carId)
    .single();

  if (carError || car.user_id !== user.id) {
    return context.redirect(`/dashboard/vehicles?error=${encodeURIComponent("Vehicle not found")}`);
  }

  const { data: siblingRepairs } = await supabase
    .from("repairs")
    .select("id, repair_date, mileage")
    .eq("car_id", carId);

  const raw = {
    car_id: carId,
    repair_date: form.get("repair_date") as string,
    description: form.get("description") as string,
    cost: form.get("cost") as string,
    mileage: Number(form.get("mileage")),
  };

  const result = createRepairSchema.safeParse(raw);
  if (!result.success) {
    const message = result.error.issues.map((e) => e.message).join(". ");
    return context.redirect(`/dashboard/repairs/new?vehicle_id=${carId}&error=${encodeURIComponent(message)}`);
  }

  const bounds = computeMileageBounds(siblingRepairs ?? [], Number(car.baseline_mileage), result.data.repair_date);
  if (result.data.mileage < bounds.min) {
    return context.redirect(
      `/dashboard/repairs/new?vehicle_id=${carId}&error=${encodeURIComponent(`Mileage must be at least ${bounds.min} km based on baseline mileage and previously logged repairs`)}`,
    );
  }
  if (result.data.mileage > bounds.max) {
    return context.redirect(
      `/dashboard/repairs/new?vehicle_id=${carId}&error=${encodeURIComponent(`Mileage must be at most ${bounds.max} km to stay consistent with a later repair already logged for this vehicle`)}`,
    );
  }

  const classified = await classifyRepair(result.data.description);
  const category = classified ?? "pending";
  const categorySource = classified ? "ai" : "pending";

  const { error } = await supabase.from("repairs").insert({
    car_id: result.data.car_id,
    user_id: user.id,
    repair_date: result.data.repair_date,
    description: result.data.description,
    cost: result.data.cost,
    mileage: result.data.mileage,
    category,
    category_source: categorySource,
    original_category: category,
  });

  if (error) {
    return context.redirect(`/dashboard/repairs/new?vehicle_id=${carId}&error=${encodeURIComponent(error.message)}`);
  }

  return context.redirect(`/dashboard/vehicles/${carId}?success=1`);
};
