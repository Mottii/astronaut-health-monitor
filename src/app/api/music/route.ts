import { readdir } from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const files = await readdir(path.join(process.cwd(), "public", "music"), { withFileTypes: true });
    const tracks = files
      .filter((file) => file.isFile() && /\.(mp3|m4a|ogg|wav|aac|flac|webm)$/i.test(file.name))
      .map((file) => `/music/${encodeURIComponent(file.name)}`)
      .sort();
    return Response.json({ tracks });
  } catch {
    return Response.json({ tracks: [] });
  }
}
