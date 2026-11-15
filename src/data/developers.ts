/**
 * Development team shown on the title page.
 *
 * Portraits live in `public/team-photos/` and are included in the repository.
 * Set `avatarPosition` to adjust the crop without changing the original image.
 * Without an avatar the card displays only the name.
 */
export interface Developer {
  id: string;
  nickname: string;
  role: string;
  avatar: string | null;
  avatarPosition?: string;
}

export const DEVELOPERS: Developer[] = [
  { id: "dev-1", nickname: "Akzhol Bakhtiyar", role: "DEVELOPER", avatar: "/team-photos/akzhol-bakhtiyar.jpg" },
  { id: "dev-2", nickname: "Almaz Rashid", role: "DEVELOPER", avatar: "/team-photos/almaz-rashid.jpg" },
  { id: "dev-3", nickname: "Karpov Alexei", role: "DEVELOPER", avatar: "/team-photos/karpov-alexei.jpg", avatarPosition: "50% 25%" },
];
