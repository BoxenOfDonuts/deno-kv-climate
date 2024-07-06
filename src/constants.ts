import { load } from "std/dotenv/mod.ts";
const env = await load();

const USER_NAME = getEnv("USER_NAME");
const PASSWORD = getEnv("PASSWORD");

function getEnv(key: string): string {
  const result = env[key] || Deno.env.get(key);
  if (!result) {
    throw new Error(
      `Missing env var ${key}, make sure you have a .env file or you pass it in via the command line`,
    );
  }
  return result;
}

export { PASSWORD, USER_NAME };
