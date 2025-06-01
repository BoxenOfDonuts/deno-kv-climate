import { Application, Router } from "@oak/oak";
import { compare } from "bcrypt";
import {
  AUTH_CACHE_KEY,
  CACHE_TTL,
  PASSWORD,
  USER_NAME,
} from "./constants/constants.ts";

import {
  createRoom,
  deleteAllKeys,
  deleteRoom,
  getAllKeys,
  getAllRoomClimates,
  getAllRooms,
  getClimate,
  getRoom,
  subscribeToChanges,
  updateRoom,
  upsertClimate,
} from "./services/db.ts";

const router = new Router();
const kv = await Deno.openKv(":memory:");

router
  .get("/rooms", async (ctx) => {
    // ctx.response.body = await getAllTemperatures();
    ctx.response.body = await getAllRooms();
  })
  .get("/rooms/climates", async (ctx) => {
    ctx.response.body = await getAllRoomClimates();
  })
  .get("/rooms/:name/climate", async (ctx) => {
    const name = ctx?.params?.name;
    ctx.response.body = await getClimate(name);
  })
  .get("/rooms/:name", async (ctx) => {
    const name = ctx?.params?.name;
    ctx.response.body = await getRoom(name);
  })
  .post("/rooms", async (ctx) => {
    const body = ctx.request.body;
    const room = await body.json();
    const success = await createRoom(room.name);
    if (!success) {
      ctx.response.status = 409;
      return;
    }
    return (ctx.response.status = 201);
  })
  .put("/rooms", async (ctx) => {
    const body = ctx.request.body;
    const room = await body.json();
    const success = await updateRoom(room);
    if (!success) {
      ctx.response.status = 409;
      return;
    }
    return (ctx.response.status = 201);
  })
  .put("/rooms/:name/climate", async (ctx) => {
    const name = ctx?.params?.name;
    const body = ctx.request.body;
    const climate = await body.json();
    const success = await upsertClimate(name, climate);
    if (!success) {
      ctx.response.status = 409;
      return;
    }
    return (ctx.response.status = 201);
  })
  .delete("/rooms/:name", async (ctx) => {
    const name = ctx?.params?.name;
    await deleteRoom(name);
    return (ctx.response.status = 204);
  })
  .get("/all", async (ctx) => {
    const prefix = ctx.request.url.searchParams.get("prefix");
    ctx.response.body = await getAllKeys(prefix);
  })
  .delete("/all", async (ctx) => {
    await deleteAllKeys();
    ctx.response.status = 204;
  })
  .get("/server-sent-events", async (ctx) => {
    console.log("server sent", ctx.request.url.searchParams.getAll("room"));
    const roomIds = ctx.request.url.searchParams.getAll("room");
    if (!roomIds.length) {
      ctx.response.status = 400;
      return;
    }
    const target = await ctx.sendEvents();
    const cancel = subscribeToChanges(roomIds, (data) => {
      target.dispatchMessage(data);
    });
    target.addEventListener("close", () => {
      console.log("client closed connection");
      cancel();
    });
  });

const app = new Application();

app.use(async (ctx, next) => {
  // if going to /server-sent-events, we don't need to check for auth
  if (ctx.request.url.pathname === "/server-sent-events") {
    await next();
    return;
  }

  const authHeader = ctx.request.headers.get("Authorization");
  if (!authHeader) {
    ctx.response.headers.append("WWW-Authenticate", "Basic");
    ctx.response.status = 401;
    return;
  }

  const b64auth = (authHeader || "").split(" ")[1] || "";
  const cachedAuth = await kv.get([AUTH_CACHE_KEY, b64auth]);
  if (cachedAuth.value !== null) {
    if (cachedAuth.value === true) {
      await next();
      return;
    }
    ctx.response.status = 401;
    return;
  }

  const [username, password] = atob(b64auth).split(":");
  if (!username || !password) {
    await kv.set([AUTH_CACHE_KEY, b64auth], false, {
      expireIn: CACHE_TTL,
    });
    ctx.response.status = 401;
    return;
  }

  const isValid = username === USER_NAME && (await compare(password, PASSWORD));
  await kv.set([AUTH_CACHE_KEY, b64auth], isValid, {
    expireIn: CACHE_TTL,
  });

  if (isValid) {
    await next();
  } else {
    ctx.response.status = 401;
    return;
  }
});
app.use(router.routes());
app.use(router.allowedMethods());

await app.listen({ port: 8000 });
