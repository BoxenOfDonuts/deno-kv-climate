export interface Room {
  id: string;
  name: string;
}

export interface Climate {
  temperature: number;
  humidity: number;
  lastUpdateDate: Date;
}

export interface CacheEntry<T> {
  value: T;
}

const roomCache: Record<string, CacheEntry<Room>> = {};

function getCacheEntry<T>(key: string) {
  return roomCache[key] || { value: null };
}

/**
 * Open KV.
 */
const kv = await Deno.openKv();

// warm up the cache
for await (const res of kv.list<Room>({ prefix: ["room"] })) {
  roomCache[res.value.name] = {
    value: res.value,
  };
}

/**
 * Upsert room.
 * @param room
 */
export async function upsertRoom(room: Room) {
  room.name = room.name.toLowerCase();
  const roomKey = ["room", room.id];
  const roomByNameKey = ["room_by_name", room.name];
  const climateKey = ["room_climate", room.name];

  const oldRoom = await kv.get<Room>(roomKey);
  const ao = kv.atomic().check(oldRoom);

  if (!oldRoom.value) {
    ao.set(roomKey, room).set(roomByNameKey, room);
  } else {
    const oldClimate = await kv.get<Climate>([
      "room_climate",
      oldRoom.value.name,
    ]);
    ao
      .delete(["room_by_name", oldRoom.value.name])
      .delete(["room_climate", oldRoom.value.name])
      .set(roomKey, room)
      .set(roomByNameKey, room)
      .set(climateKey, oldClimate.value);
  }

  const ok = await ao.commit();
  if (!ok) {
    throw new Error(`Failed to update room '${room.name}'.`);
  }
}

/**
 * Update climate.
 * @param roomName
 * @param climate
 */
// upsert climate has about the same writes now as the original function!
export async function upsertClimate(roomName: string, climate: Climate) {
  roomName = roomName.toLowerCase();
  const climateKey = ["room_climate", roomName];

  const room = getCacheEntry(roomName);

  if (!room.value) {
    console.error(`Room '${roomName}' not found.`);
    return;
  }
  const ok = await kv.set(climateKey, climate);
  if (!ok) {
    throw new Error(
      `Failed to update climate settings for room '${roomName}'.`,
    );
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
  if (!room) {
    console.info(`Room '${name}' not found.`);
    return;
  }
  const roomKey = ["room", room.id];
  const roomByNameKey = ["room_by_name", room.name];
  const climateKey = ["room_climate", room.name];
  await kv.delete(roomKey);
  await kv.delete(roomByNameKey);
  await kv.delete(climateKey);
}

/**
 * Get all keys.
 * @param prefix
 */
export async function getAllKeys(value?: string) {
  const prefix = value ? [value] : [];
  return await Array.fromAsync(kv.list({ prefix }));
}
