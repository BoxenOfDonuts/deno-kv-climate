export interface Room {
    id: string;
    name: string;
}

export interface Climate {
    temperature: number;
    humidity: number;
    lastUpdateDate: Date;
}

/**
 * Open KV.
 */
const kv = await Deno.openKv();

/**
 * Upsert room.
 * @param room
 */
export async function upsertRoom(room: Room) {
    room.name = room.name.toLowerCase();
    const roomKey = ["room", room.id];
    const roomByNameKey = ["room_by_name", room.name];

    const oldRoom = await kv.get<Room>(roomKey);

    if (!oldRoom.value) {
        const ok = await kv.atomic()
            .check(oldRoom)
            .set(roomKey, room)
            .set(roomByNameKey, room)
            .commit();
        if (!ok) throw new Error("Something went wrong.");
    } else {
        const ok = await kv.atomic()
            .check(oldRoom)
            .delete(["room_by_name", oldRoom.value.name])
            .set(roomKey, room)
            .set(roomByNameKey, room)
            .commit();
        if (!ok) throw new Error("Something went wrong.");
    }
}

/**
 * Update climate.
 * @param room
 * @param climate
 */
export async function upsertClimate(room: Room, climate: Climate) {
    room.name = room.name.toLowerCase();
    const roomKey = ["room", room.id];
    const roomByNameKey = ["room_by_name", room.name];
    const climateKey = ["room_climate", room.name];

    const oldRoom = await kv.get<Room>(roomKey);

    if (!oldRoom.value) {
        const ok = await kv.atomic()
            .check(oldRoom)
            .set(roomKey, room)
            .set(roomByNameKey, room)
            .set(climateKey, climate)
            .commit();
        if (!ok) throw new Error("Something went wrong.");
    } else {
        const ok = await kv.atomic()
            .check(oldRoom)
            .delete(["room_by_name", oldRoom.value.name])
            .set(roomKey, room)
            .set(roomByNameKey, room)
            .set(climateKey, climate)
            .commit();
        if (!ok) throw new Error("Something went wrong.");
    }
}

/**
 * Get all rooms.
 * @returns <Room>
 */
export async function getAllRooms() {
    const rooms = [];
    for await (const res of kv.list({ prefix: ["room"] })) {
        rooms.push(res.value);
    }
    return rooms;
}

/**
 * Get all climates.
 * @returns <Climate>
 */
export async function getAllRoomClimates() {
    const climates = [];
    for await (const res of kv.list<Room>({ prefix: ["room"] })) {
        // attach room name and id to climate
        const room = await getRoomById(res.value.id) as Room;
        const climate = await getClimateByRoomName(room.name);
        climates.push({ ...room, ...climate });
    }
    return climates;
}

/**
 * Get room by id.
 * @param id
 * @returns <Room>
 */
export async function getRoomById(id: string) {
    return (await kv.get<Room>(["room", id])).value;
}

/**
 * Get room by name.
 * @param name
 * @returns <Room>
 */
// this is the problem function
export async function getRoomByName(name: string) {
    name = name.toLowerCase();
    const roomByNameKey = ["room_by_name", name];
    return (await kv.get(roomByNameKey)).value as Room;
}

/**
 * Get climate by room id.
 * @param id
 * @returns <Climate>
 */
export async function getClimateByRoomName(name: string) {
    name = name.toLowerCase();
    // const room = await getRoomByName(name);
    return (await kv.get<Climate>(["room_climate", name]))
        .value as Climate;
}

/**
 * Delete room by id.
 * @param id
 */
export async function deleteRoomByName(name: string) {
    name = name.toLowerCase();
    const room = await getRoomByName(name);
    const roomKey = ["room", room.id];
    const roomByNameKey = ["room_by_name", room.name];
    const climateKey = ["room_climate", room.name];
    await kv.delete(roomKey);
    await kv.delete(roomByNameKey);
    await kv.delete(climateKey);
}
