import {
  KV_PATH,
  ROOM_BY_ID_KEY,
  ROOM_CLIMATE_KEY,
  ROOM_KEY,
} from "../constants/constants.ts";

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
const kv = await Deno.openKv(KV_PATH);

/**
 * create room.
 * @param roomName The name of the room to upsert.
 */
export async function createRoom(roomName: string) {
  const roomKey = [ROOM_KEY, roomName];

  const roomId = crypto.randomUUID();
  const room = { id: roomId, name: roomName } as Room;

  const roomByIdKey = [ROOM_BY_ID_KEY, room.id];

  const op = kv.atomic().check({ key: roomKey, versionstamp: null });

  op.set(roomKey, room);
  // with large data sets, duplicate data could be a problem
  // but the room is small enough that it's not a big deal
  op.set(roomByIdKey, room);

  const { ok } = await op.commit();
  return ok;
}

/**
 * update room
 * @param room
 */
export async function updateRoom(room: Room) {
  const roomKey = [ROOM_KEY, room.name];
  const roomByIdKey = [ROOM_BY_ID_KEY, room.id];

  const oldRoom = await kv.get<Room>(roomByIdKey);
  const op = kv.atomic().check({ key: roomKey, versionstamp: null });

  op.set(roomKey, room);
  op.set(roomByIdKey, room);

  if (oldRoom.value) {
    op.delete([ROOM_KEY, oldRoom.value.name]);

    const climateKey = [ROOM_CLIMATE_KEY, oldRoom.value.name];
    const climate = await kv.get<Climate>(climateKey);
    if (climate.value) {
      op.delete(climateKey);
      op.set([ROOM_CLIMATE_KEY, room.name], climate.value);
    }
  }

  const { ok } = await op.commit();
  return ok;
}

/**
 * Update climate.
 * @param roomId
 * @param climate
 */
export async function upsertClimate(roomName: string, climate: Climate) {
  const roomKey = [ROOM_KEY, roomName];
  const climateKey = [ROOM_CLIMATE_KEY, roomName];

  if (!climate.lastUpdateDate) {
    climate.lastUpdateDate = new Date();
  }

  const room = await kv.get<Room>(roomKey);
  if (!room.value) {
    console.error(`Room '${roomName}' not found.`);
    return false;
  }
  const { ok } = await kv.set(climateKey, climate);
  return ok;
}

/**
 * Get all rooms.
 * @returns <Room>
 */
export async function getAllRooms() {
  const rooms = [];
  for await (const res of kv.list({ prefix: [ROOM_KEY] })) {
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
  for await (const res of kv.list<Room>({ prefix: [ROOM_KEY] })) {
    // attach room name and id to climate
    const room = await getRoom(res.value.name) as Room;
    const climate = await getClimate(room.name);
    climates.push({ ...room, ...climate });
  }
  return climates;
}

/**
 * Get room by name.
 * @param name
 * @returns <Room>
 */
// this is the problem function
export async function getRoom(name: string) {
  name = name.toLowerCase();
  const roomByNameKey = [ROOM_KEY, name];
  return (await kv.get(roomByNameKey)).value as Room;
}

/**
 * Get climate by room name.
 * @param id
 * @returns <Climate>
 */
export async function getClimate(name: string) {
  return (await kv.get<Climate>([ROOM_CLIMATE_KEY, name]))
    .value as Climate;
}

/**
 * Delete room by id.
 * @param id
 */
export async function deleteRoom(name: string) {
  const room = await getRoom(name);
  if (!room) {
    console.info(`Room '${name}' not found.`);
    return;
  }
  const roomKey = [ROOM_KEY, room.name];
  const roomByIdKey = [ROOM_BY_ID_KEY, room.id];
  const climateKey = ["room_climate", room.name];
  await kv.delete(roomKey);
  await kv.delete(roomByIdKey);
  await kv.delete(climateKey);
}

/**
 * Get all keys.
 * @param prefix
 */
export async function getAllKeys(value?: string | null) {
  const prefix = value ? [value] : [];
  return await Array.fromAsync(kv.list({ prefix }));
}

/** */
export async function deleteAllKeys() {
  const allEntries = await Array.fromAsync(kv.list({ prefix: [] }));
  for (const entry of allEntries) {
    kv.delete(entry.key);
  }
}

export function subscribeToChanges(ids: string[], cb: (room: Room) => void) {
  const keys = ids.map((id) => ["room_climate", id]);
  const stream = kv.watch([...keys]);
  const reader = stream.getReader();
  (async () => {
    while (true) {
      const x = await reader.read();
      if (x.done) {
        console.log("subscribeGame: Subscription stream closed");
        return;
      }

      // x.value!.forEach((entry) => {
      //   if (entry.value) {
      //     cb(entry.value as Room);
      //   }
      // });

      const [room] = x.value!;
      if (room.value) {
        cb(room.value as Room);
      }
    }
  })();

  return () => {
    reader.cancel();
  };
}
