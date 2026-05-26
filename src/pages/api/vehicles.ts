import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";
import { createVehicleSchema } from "@/lib/schemas";

export const POST: APIRoute = async (context) => {
  const user = context.locals.user;
  if (!user) {
    return context.redirect("/auth/signin");
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return context.redirect(`/dashboard/vehicles/new?error=${encodeURIComponent("Supabase is not configured")}`);
  }

  const form = await context.request.formData();
  const raw = {
    make: form.get("make") as string,
    model: form.get("model") as string,
    year: Number(form.get("year")),
    current_mileage: Number(form.get("current_mileage")),
    baseline_mileage: Number(form.get("baseline_mileage")),
  };

  const result = createVehicleSchema.safeParse(raw);
  if (!result.success) {
    const message = result.error.issues.map((e) => e.message).join(". ");
    return context.redirect(`/dashboard/vehicles/new?error=${encodeURIComponent(message)}`);
  }

  const { error } = await supabase.from("cars").insert({
    user_id: user.id,
    make: result.data.make,
    model: result.data.model,
    year: result.data.year,
    current_mileage: result.data.current_mileage,
    baseline_mileage: result.data.baseline_mileage,
  });

  if (error) {
    return context.redirect(`/dashboard/vehicles/new?error=${encodeURIComponent(error.message)}`);
  }

  return context.redirect("/dashboard/vehicles");
};
