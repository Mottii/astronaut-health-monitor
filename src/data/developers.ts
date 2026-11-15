/**
 * Development team shown on the title page.
 *
 * To personalise a card: set `nickname`, `role`, and drop a square-ish portrait into
 * `public/avatars/` and point `avatar` at it (e.g. "/avatars/dev-1.jpg").
 * Without an avatar the card uses a minimal numbered editorial layout.
 */
export interface Developer {
  id: string;
  nickname: string;
  role: string;
  avatar: string | null;
}

export const DEVELOPERS: Developer[] = [
  { id: "dev-1", nickname: "NICKNAME_01", role: "DEVELOPER", avatar: null },
  { id: "dev-2", nickname: "NICKNAME_02", role: "DEVELOPER", avatar: null },
  { id: "dev-3", nickname: "NICKNAME_03", role: "DEVELOPER", avatar: null },
];
