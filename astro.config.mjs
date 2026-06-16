// @ts-check
import { defineConfig, envField } from "astro/config";

import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import node from "@astrojs/node";

import sentry from "@sentry/astro";

// https://astro.build/config
export default defineConfig({
  site: "https://car-repair-tracker.msolve.it",
  output: "server",
  integrations: [
    react(),
    sitemap(),
    sentry({
      sourceMapsUploadOptions: {
        project: "car-repair-tracker",
        org: "e42014e5b963",
        // eslint-disable-next-line no-undef
        authToken: process.env.SENTRY_AUTH_TOKEN,
      },
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
    server: {
      // Pre-bundle island dependencies at dev startup so the first visit to a
      // route doesn't trigger Vite's mid-run "Outdated Optimize Dep" 504, which
      // aborts React island hydration (e.g. the edit-repair form's submit would
      // fall back to a native page reload). Dev-only; does not affect prod build.
      warmup: {
        clientFiles: [
          "./src/components/auth/SignInForm.tsx",
          "./src/components/auth/SignUpForm.tsx",
          "./src/components/vehicles/AddVehicleForm.tsx",
          "./src/components/vehicles/CostTrendChart.tsx",
          "./src/components/repairs/AddRepairForm.tsx",
          "./src/components/repairs/EditRepairForm.tsx",
          "./src/components/repairs/RepairList.tsx",
        ],
      },
    },
  },
  adapter: node({ mode: "standalone" }),
  security: {
    allowedDomains: [{ hostname: "car-repair-tracker.msolve.it", protocol: "https" }],
  },
  env: {
    schema: {
      SUPABASE_URL: envField.string({ context: "server", access: "secret", optional: true }),
      SUPABASE_KEY: envField.string({ context: "server", access: "secret", optional: true }),
      GEMINI_API_KEY: envField.string({ context: "server", access: "secret", optional: true }),
      SENTRY_AUTH_TOKEN: envField.string({ context: "server", access: "secret", optional: true }),
    },
  },
});
