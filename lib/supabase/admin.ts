import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let adminClient: SupabaseClient | null = null;

export class SupabaseAdminConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SupabaseAdminConfigurationError";
  }
}

export function createAdminClient(): SupabaseClient {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseSecretKey =
    process.env.SUPABASE_SECRET_KEY ??
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new SupabaseAdminConfigurationError(
      "Missing SUPABASE_URL in the server environment."
    );
  }

  if (!supabaseSecretKey) {
    throw new SupabaseAdminConfigurationError(
      "Missing SUPABASE_SECRET_KEY in the server environment."
    );
  }

  if (!adminClient) {
    adminClient = createClient(supabaseUrl, supabaseSecretKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });
  }

  return adminClient;
}
