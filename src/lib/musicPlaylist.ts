/** Select another song, including when only one playable file remains. */
export function pickMusicTrack(tracks: readonly string[], previous: string | null, random = Math.random): string | null {
  const unique = [...new Set(tracks)];
  const alternatives = unique.filter((track) => track !== previous);
  const candidates = alternatives.length ? alternatives : unique;
  if (!candidates.length) return null;
  return candidates[Math.min(candidates.length - 1, Math.max(0, Math.floor(random() * candidates.length)))];
}
