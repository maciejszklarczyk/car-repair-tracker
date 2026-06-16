import type { APIRoute } from "astro";

export const prerender = false;

export const GET: APIRoute = () => {
  throw new Error("Sentry test error: this is a deliberate server-side exception");
};
