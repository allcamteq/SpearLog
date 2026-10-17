import { spawnSync } from "node:child_process";

function runNpm(args) {
  const result = spawnSync("npm", args, { stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

if (process.env.VERCEL_ENV === "production") {
  const databaseUrl = process.env.TURSO_DATABASE_URL;
  if (!databaseUrl || databaseUrl.startsWith("file:")) {
    throw new Error("Production deployment requires a remote TURSO_DATABASE_URL before running migrations.");
  }
  runNpm(["run", "db:migrate"]);
}

runNpm(["run", "build"]);