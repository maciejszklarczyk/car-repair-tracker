import type { APIRoute } from "astro";
import { createAdminClient } from "@/lib/supabase-admin";
import { createClient } from "@/lib/supabase";
import { seedDemoData } from "@/lib/demo-seed";

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const adminClient = createAdminClient();
  if (!adminClient) {
    return context.redirect("/?error=demo_failed");
  }

  let userId: string | null = null;

  try {
    const email = `demo-${Date.now()}@demo.cartracker.local`;
    const password = crypto.randomUUID();

    const { data: userData, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (createError) {
      return context.redirect("/?error=demo_failed");
    }

    userId = userData.user.id;

    await seedDemoData(adminClient, userId);

    const supabase = createClient(context.request.headers, context.cookies);
    if (!supabase) {
      await adminClient.auth.admin.deleteUser(userId);
      return context.redirect("/?error=demo_failed");
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) {
      await adminClient.auth.admin.deleteUser(userId);
      return context.redirect("/?error=demo_failed");
    }

    return context.redirect("/dashboard/vehicles");
  } catch {
    if (userId) {
      await adminClient.auth.admin.deleteUser(userId);
    }
    return context.redirect("/?error=demo_failed");
  }
};
