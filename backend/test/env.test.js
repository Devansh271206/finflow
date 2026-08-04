const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

function loadEnvModule() {
  const envPath = path.join(__dirname, "..", "src", "config", "env.js");
  delete require.cache[require.resolve(envPath)];
  return require(envPath);
}

test("env config fails fast when required Supabase settings are missing", () => {
  const original = {
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };

  process.env.SUPABASE_URL = "";
  process.env.SUPABASE_ANON_KEY = "";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "";

  try {
    assert.throws(() => loadEnvModule(), /SUPABASE_URL|SUPABASE_ANON_KEY|SUPABASE_SERVICE_ROLE_KEY/);
  } finally {
    Object.entries(original).forEach(([key, value]) => {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    });
  }
});

test("env config exposes safe defaults for non-secret settings", () => {
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_ANON_KEY = "anon-key";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";

  const env = loadEnvModule();

  assert.equal(env.NODE_ENV, "development");
  assert.equal(env.PORT, 5000);
  assert.equal(env.CORS_ORIGIN, "http://localhost:5173,http://localhost:3000");
  assert.equal(env.SUPABASE_STORAGE_BUCKET, "finflow-uploads");
});
