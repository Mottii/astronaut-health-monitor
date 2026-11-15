import { afterEach, describe, expect, it, vi } from "vitest";
import { readdir } from "node:fs/promises";
import { GET } from "@/app/api/music/route";

vi.mock("node:fs/promises", () => ({ readdir: vi.fn() }));

describe("music folder discovery", () => {
  afterEach(() => vi.resetAllMocks());

  it("lists audio files with URL-safe names while excluding folders and unrelated files", async () => {
    vi.mocked(readdir).mockResolvedValue([
      { name: "space music.mp3", isFile: () => true },
      { name: "track.M4A", isFile: () => true },
      { name: "readme.txt", isFile: () => true },
      { name: "album.mp3", isFile: () => false },
    ] as never);
    const response = await GET();
    expect(await response.json()).toEqual({ tracks: ["/music/space%20music.mp3", "/music/track.M4A"] });
  });

  it("returns an empty playlist if the music folder is missing", async () => {
    vi.mocked(readdir).mockRejectedValue(new Error("ENOENT"));
    expect(await (await GET()).json()).toEqual({ tracks: [] });
  });
});
