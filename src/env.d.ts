/// <reference path="../.astro/types.d.ts" />
/// <reference types="@cloudflare/workers-types" />

interface CloudflareEnv {
  DB: D1Database;
  SESSIONS: KVNamespace;
  OLLAMA_BASE_URL: string;
  OLLAMA_MODEL: string;
}

declare module "cloudflare:workers" {
  const env: CloudflareEnv;
}

declare namespace App {
  interface Locals {
    user?: {
      id: string;
      email: string;
    };
  }
}
