import { Application, Router } from "@oak/oak";
import { compareSync } from "bcrypt";
import { PASSWORD, USER_NAME } from "./src/constants.ts";

import {
    deleteRoomByName,
    getAllRoomClimates,
    getAllRooms,
    getClimateByRoomName,
    getRoomByName,
    upsertClimate,
    upsertRoom,
} from "./src/db.ts";

const router = new Router();

router
    .get("/rooms", async (ctx) => {
        // ctx.response.body = await getAllTemperatures();
        ctx.response.body = await getAllRooms();
    })
    .get("/room/climates", async (ctx) => {
        ctx.response.body = await getAllRoomClimates();
    })
    .get("/climates/:name", async (ctx) => {
        const name = ctx?.params?.name;
        ctx.response.body = await getClimateByRoomName(name);
    })
    .get("/room/:name", async (ctx) => {
        const name = ctx?.params?.name;
        ctx.response.body = await getRoomByName(name);
    })
    .post("/room", async (ctx) => {
        const body = ctx.request.body;
        const room = await body.json();
        await upsertRoom(room);
        return ctx.response.status = 201;
    })
    .post("/room/:name/climate", async (ctx) => {
        const name = ctx?.params?.name;
        const body = ctx.request.body;
        const climate = await body.json();
        const room = await getRoomByName(name);
        if (!room) return ctx.response.status = 404;
        await upsertClimate(room, climate);
        return ctx.response.status = 201;
    })
    .delete("/room/:name", async (ctx) => {
        const name = ctx?.params?.name;
        await deleteRoomByName(name);
        return ctx.response.status = 204;
    });

const app = new Application();

app.use(async (ctx, next) => {
    const authHeader = ctx.request.headers.get("Authorization");
    if (!authHeader) {
        ctx.response.headers.append("WWW-Authenticate", "Basic");
        ctx.response.status = 401;
        return;
    }
    const b64auth = (authHeader || "").split(" ")[1] || "";
    const [username, password] = atob(b64auth).split(":");
    if (!username || !password) {
        ctx.response.status = 401;
        return;
    }
    if (username === USER_NAME && compareSync(password, PASSWORD)) {
        await next();
    } else {
        ctx.response.status = 401;
        return;
    }
});
app.use(router.routes());
app.use(router.allowedMethods());

await app.listen({ port: 8000 });
