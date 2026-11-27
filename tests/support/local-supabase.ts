import { execFileSync } from "node:child_process";
import { loadEnvConfig } from "@next/env";
import { Client } from "pg";

/**
 * Guard and fault injection for tests that change the local Supabase stack.
 *
 * Every destructive step calls the guard first. It throws, never skips, unless
 * the API URL and the database connection both point at this machine.
 * The values come from `.env.local` (shell variables take precedence).
 */
loadEnvConfig(process.cwd());

const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost"]);
const DB_PORT = "54322";
// Container names follow `project_id` in supabase/config.toml.
const DB_CONTAINER = "supabase_db_sonika";
const GATEWAY_CONTAINER = "supabase_kong_sonika";

const dbUrl = () =>
  process.env.SUPABASE_DB_URL ?? `postgresql://postgres:postgres@127.0.0.1:${DB_PORT}/postgres`;

const REVOKE_PROFILES = "REVOKE SELECT ON TABLE public.profiles FROM authenticated;";
const GRANT_PROFILES = "GRANT SELECT ON TABLE public.profiles TO authenticated;";

function refuse(reason: string): never {
  throw new Error(`Refusing to run tests against a non-local Supabase: ${reason}`);
}

export function assertLocalSupabase() {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!raw) refuse("NEXT_PUBLIC_SUPABASE_URL is not set.");
  const api = new URL(raw);
  if (api.protocol !== "http:" || !LOCAL_HOSTS.has(api.hostname)) {
    refuse(`API host is "${api.hostname}", expected 127.0.0.1 or localhost over http.`);
  }

  const db = new URL(dbUrl());
  // A query string such as `?host=` would override the host checked here.
  if (!LOCAL_HOSTS.has(db.hostname) || db.port !== DB_PORT || db.search) {
    refuse(`database is "${db.host}", expected 127.0.0.1:${DB_PORT} with no parameters.`);
  }
}

async function sql<T extends Record<string, unknown>>(query: string): Promise<T[]> {
  assertLocalSupabase();
  const client = new Client({ connectionString: dbUrl(), connectionTimeoutMillis: 5000 });
  await client.connect();
  try {
    return (await client.query(query)).rows as T[];
  } finally {
    await client.end();
  }
}

const docker = (...args: string[]) =>
  execFileSync("docker", args, { encoding: "utf8", timeout: 30_000 }).trim();

/** Containers are only touched on a local Docker engine that serves those ports. */
function assertLocalDocker() {
  assertLocalSupabase();
  const endpoint =
    process.env.DOCKER_HOST || docker("context", "inspect", "--format", "{{.Endpoints.docker.Host}}");
  if (!/^(npipe|unix):/.test(endpoint)) refuse("the Docker engine is not local.");

  const apiPort = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).port;
  if (!docker("port", GATEWAY_CONTAINER, "8000").includes(`:${apiPort}`)) {
    refuse(`${GATEWAY_CONTAINER} does not serve port ${apiPort}.`);
  }
  if (!docker("port", DB_CONTAINER, "5432").includes(`:${DB_PORT}`)) {
    refuse(`${DB_CONTAINER} does not serve port ${DB_PORT}.`);
  }
}

function manualRestore(command: string, cause: unknown): never {
  console.error(
    [
      "",
      "!!! RESTORE FAILED. Your local Supabase is still modified. Run by hand:",
      `    ${command}`,
      "",
    ].join("\n"),
  );
  throw cause;
}

const canReadProfiles = async () =>
  (
    await sql<{ ok: boolean }>(
      "select has_table_privilege('authenticated', 'public.profiles', 'SELECT') as ok",
    )
  )[0].ok;

/** Makes every signed-in profile lookup fail with "permission denied". */
export async function revokeProfilesRead() {
  await sql(REVOKE_PROFILES);
}

export async function restoreProfilesRead() {
  try {
    await sql(GRANT_PROFILES);
    if (!(await canReadProfiles())) throw new Error("The grant on public.profiles is still missing.");
  } catch (error) {
    manualRestore(
      `docker exec ${DB_CONTAINER} psql -U postgres -d postgres -c "${GRANT_PROFILES}"`,
      error,
    );
  }
}

const isPaused = () =>
  docker("inspect", "--format", "{{.State.Paused}}", GATEWAY_CONTAINER) === "true";

/** Connections to Supabase are accepted but never answered. */
export function pauseGateway() {
  assertLocalDocker();
  docker("pause", GATEWAY_CONTAINER);
}

export async function resumeGateway() {
  try {
    assertLocalDocker();
    if (isPaused()) docker("unpause", GATEWAY_CONTAINER);
    const health = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/health`;
    const headers = { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! };
    for (let attempt = 0; attempt < 30; attempt++) {
      const ok = await fetch(health, { headers, signal: AbortSignal.timeout(2000) })
        .then((res) => res.ok)
        .catch(() => false);
      if (ok) return;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    throw new Error("The gateway did not answer after being unpaused.");
  } catch (error) {
    manualRestore(`docker unpause ${GATEWAY_CONTAINER}`, error);
  }
}

/** Run once before the suite: refuse non-local setups and a half-restored stack. */
export async function assertReadyToTest() {
  assertLocalDocker();
  if (isPaused()) {
    throw new Error(`The gateway is paused. Run: docker unpause ${GATEWAY_CONTAINER}`);
  }
  if (!(await canReadProfiles())) {
    throw new Error(`A grant is missing. Run in the local database: ${GRANT_PROFILES}`);
  }
}
