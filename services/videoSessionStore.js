import fs from "fs/promises";
import path from "path";

const DATA_DIR = path.resolve("data");
const DB_PATH = path.join(DATA_DIR, "videoSessions.json");

let writeQueue = Promise.resolve();

async function ensureDbFile() {
  await fs.mkdir(DATA_DIR, { recursive: true });

  try {
    await fs.access(DB_PATH);
  } catch {
    await fs.writeFile(DB_PATH, "[]", "utf8");
  }
}

async function readDb() {
  await ensureDbFile();
  const raw = await fs.readFile(DB_PATH, "utf8");

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeDb(records) {
  await ensureDbFile();

  const tempPath = `${DB_PATH}.tmp`;
  await fs.writeFile(tempPath, JSON.stringify(records, null, 2), "utf8");
  await fs.rename(tempPath, DB_PATH);
}

export function upsertVideoSession(record) {
  writeQueue = writeQueue.then(async () => {
    const records = await readDb();
    const index = records.findIndex((item) => item.id === record.id);

    if (index >= 0) {
      records[index] = {
        ...records[index],
        ...record,
      };
    } else {
      records.push(record);
    }

    await writeDb(records);
  });

  return writeQueue;
}

export async function getVideoSessionById(id) {
  const records = await readDb();
  return records.find((item) => item.id === id) || null;
}

export function deleteVideoSessionById(id) {
  writeQueue = writeQueue.then(async () => {
    const records = await readDb();
    const filtered = records.filter((item) => item.id !== id);
    await writeDb(filtered);
  });

  return writeQueue;
}

export function deleteVideoSessionsByKey(key) {
  writeQueue = writeQueue.then(async () => {
    const records = await readDb();
    const filtered = records.filter((item) => item.key !== key);
    await writeDb(filtered);
  });

  return writeQueue;
}

export async function listAllVideoSessions() {
  return readDb();
}