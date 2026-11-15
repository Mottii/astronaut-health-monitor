import { describe, expect, it } from "vitest";
import { pickMusicTrack } from "@/lib/musicPlaylist";

describe("local music selection", () => {
  it("randomises the first song and never repeats the current song when another exists", () => {
    const tracks = ["/music/a.mp3", "/music/b.m4a", "/music/c.ogg"];
    expect(pickMusicTrack(tracks, null, () => 0)).toBe(tracks[0]);
    expect(pickMusicTrack(tracks, null, () => 0.99)).toBe(tracks[2]);
    for (const current of tracks) {
      for (const random of [0, 0.3, 0.7, 0.99]) expect(pickMusicTrack(tracks, current, () => random)).not.toBe(current);
    }
  });
  it("handles empty folders, one remaining file and duplicate entries", () => {
    expect(pickMusicTrack([], null)).toBeNull();
    expect(pickMusicTrack(["one"], "one")).toBe("one");
    expect(pickMusicTrack(["one", "one", "two"], "one")).toBe("two");
  });
});
