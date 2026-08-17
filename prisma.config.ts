import { config } from "dotenv";
import { defineConfig, env } from "prisma/config";

// This project keeps real values only in `.env.local` (see .env.example) and
// never creates a plain `.env` file, so `dotenv/config`'s default load would
// find nothing. Point it at `.env.local` explicitly.
config({ path: ".env.local" });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
