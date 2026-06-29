import type { TeamAssignment } from './lib/teamAssignment';

export type AppPhase = 'setup' | 'select' | 'groups' | 'roulette' | 'results';

export interface ClassSettings {
  teamCount: number;
}

export interface StoredSpreadGroup {
  id: string;
  label: string;
  memberIds: string[];
}

export interface StoredSession {
  phase: AppPhase;
  settings: ClassSettings;
  selectedIds: string[];
  characterNames: Record<string, string>;
  spreadGroups: StoredSpreadGroup[];
  assignment: TeamAssignment | null;
  updatedAt: string;
}
