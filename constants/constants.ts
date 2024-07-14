import { load } from "std/dotenv/mod.ts";
const env = await load();

const USER_NAME = getEnv("USER_NAME");
const PASSWORD = getEnv("PASSWORD");

Deno.env.set("DENO_KV_ACCESS_TOKEN", getEnv("DENO_KV_ACCESS_TOKEN"));
const KV_PATH = _undefinedEnv("KV_PATH");

const ROOM_KEY = "room";
const ROOM_CLIMATE_KEY = "room_climate";
const ROOM_BY_ID_KEY = "room_by_id";

function getEnv(key: string): string {
  const result = env[key] || Deno.env.get(key);
  if (!result) {
    throw new Error(
      `Missing env var ${key}, make sure you have a .env file or you pass it in via the command line`,
    );
  }
  return result;
}

function _undefinedEnv(key: string): string | undefined {
  return env[key] || Deno.env.get(key);
}

export {
  KV_PATH,
  PASSWORD,
  ROOM_BY_ID_KEY,
  ROOM_CLIMATE_KEY,
  ROOM_KEY,
  USER_NAME,
};
