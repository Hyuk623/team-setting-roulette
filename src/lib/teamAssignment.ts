export interface SpreadGroupInput {
  id: string;
  memberIds: string[];
}

export interface AssignTeamsInput {
  participantIds: string[];
  teamCount: number;
  spreadGroups?: SpreadGroupInput[];
  seed: string | number;
}

export interface TeamResult {
  teamIndex: number;
  teamNumber: number;
  targetSize: number;
  participantIds: string[];
}

export interface TeamAssignment {
  seed: string;
  teamCount: number;
  teams: TeamResult[];
}

interface NormalizedSpreadGroup {
  id: string;
  memberIds: string[];
}

interface PlannedSpreadGroup {
  id: string;
  memberIds: string[];
  teamCounts: number[];
}

type RandomSource = () => number;

export function createSeededRandom(seed: string | number): RandomSource {
  let state = hashSeed(String(seed));

  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function assignTeams(input: AssignTeamsInput): TeamAssignment {
  const participantIds = normalizeParticipants(input.participantIds);
  const teamCount = normalizeTeamCount(input.teamCount);
  const spreadGroups = normalizeSpreadGroups(
    input.spreadGroups ?? [],
    new Set(participantIds),
  );
  const seed = String(input.seed);
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < 100; attempt += 1) {
    const rng = createSeededRandom(`${seed}:attempt:${attempt}`);
    const targetSizes = createTargetSizes(participantIds.length, teamCount, rng);

    try {
      const spreadPlan = planSpreadGroups(spreadGroups, targetSizes, rng);
      const assignment = materializeTeams(
        participantIds,
        targetSizes,
        spreadPlan,
        rng,
      );
      assertAssignment(assignment, participantIds, targetSizes);

      return {
        seed,
        teamCount,
        teams: assignment,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }

  throw new Error(
    `팀 배정을 만들 수 없습니다. ${lastError?.message ?? '입력을 확인하세요.'}`,
  );
}

export function getTeamSizeSpread(assignment: TeamAssignment): number {
  const sizes = assignment.teams.map((team) => team.participantIds.length);
  return Math.max(...sizes) - Math.min(...sizes);
}

function hashSeed(seed: string): number {
  let hash = 2166136261;

  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0 || 1;
}

function normalizeParticipants(participantIds: string[]): string[] {
  const trimmed = participantIds.map((id) => id.trim()).filter(Boolean);
  const unique = new Set(trimmed);

  if (unique.size !== trimmed.length) {
    throw new Error('참가자 ID는 중복될 수 없습니다.');
  }

  return trimmed;
}

function normalizeTeamCount(teamCount: number): number {
  if (!Number.isInteger(teamCount) || teamCount < 2 || teamCount > 8) {
    throw new Error('팀 수는 2개에서 8개 사이여야 합니다.');
  }

  return teamCount;
}

function normalizeSpreadGroups(
  groups: SpreadGroupInput[],
  participantSet: Set<string>,
): NormalizedSpreadGroup[] {
  const assigned = new Set<string>();

  return groups
    .map((group) => {
      const memberIds = Array.from(
        new Set(group.memberIds.filter((id) => participantSet.has(id))),
      );

      for (const memberId of memberIds) {
        if (assigned.has(memberId)) {
          throw new Error('한 캐릭터는 하나의 피하기 묶음에만 들어갈 수 있습니다.');
        }
        assigned.add(memberId);
      }

      return {
        id: group.id,
        memberIds,
      };
    })
    .filter((group) => group.memberIds.length > 0);
}

function createTargetSizes(
  participantCount: number,
  teamCount: number,
  rng: RandomSource,
): number[] {
  const baseSize = Math.floor(participantCount / teamCount);
  const extraCount = participantCount % teamCount;
  const targetSizes = Array.from({ length: teamCount }, () => baseSize);
  const teamOrder = shuffle(
    Array.from({ length: teamCount }, (_, index) => index),
    rng,
  );

  for (let index = 0; index < extraCount; index += 1) {
    targetSizes[teamOrder[index]] += 1;
  }

  return targetSizes;
}

function planSpreadGroups(
  groups: NormalizedSpreadGroup[],
  targetSizes: number[],
  rng: RandomSource,
): PlannedSpreadGroup[] {
  const teamCount = targetSizes.length;
  const loadByTeam = Array.from({ length: teamCount }, () => 0);
  const groupOrder = groups
    .map((group) => ({ group, tieBreaker: rng() }))
    .sort((left, right) => {
      const bySize = right.group.memberIds.length - left.group.memberIds.length;
      return bySize || left.tieBreaker - right.tieBreaker;
    });

  return groupOrder.map(({ group }) => {
    const baseCount = Math.floor(group.memberIds.length / teamCount);
    const extraCount = group.memberIds.length % teamCount;
    const teamCounts = Array.from({ length: teamCount }, () => baseCount);

    for (let teamIndex = 0; teamIndex < teamCount; teamIndex += 1) {
      loadByTeam[teamIndex] += baseCount;

      if (loadByTeam[teamIndex] > targetSizes[teamIndex]) {
        throw new Error('같은 팀 피하기 묶음 기본 배치가 팀 정원을 초과했습니다.');
      }
    }

    const extraTeams = rankTeamsForExtra(loadByTeam, targetSizes, rng).slice(
      0,
      extraCount,
    );

    if (
      extraTeams.length < extraCount ||
      extraTeams.some((teamIndex) => loadByTeam[teamIndex] >= targetSizes[teamIndex])
    ) {
      throw new Error('같은 팀 피하기 묶음 추가 인원을 배치할 수 없습니다.');
    }

    for (const teamIndex of extraTeams) {
      teamCounts[teamIndex] += 1;
      loadByTeam[teamIndex] += 1;
    }

    return {
      id: group.id,
      memberIds: group.memberIds,
      teamCounts,
    };
  });
}

function rankTeamsForExtra(
  loadByTeam: number[],
  targetSizes: number[],
  rng: RandomSource,
): number[] {
  return loadByTeam
    .map((load, teamIndex) => ({
      teamIndex,
      spare: targetSizes[teamIndex] - load,
      tieBreaker: rng(),
    }))
    .filter((team) => team.spare > 0)
    .sort((left, right) => {
      const bySpare = right.spare - left.spare;
      return bySpare || left.tieBreaker - right.tieBreaker;
    })
    .map((team) => team.teamIndex);
}

function materializeTeams(
  participantIds: string[],
  targetSizes: number[],
  spreadPlan: PlannedSpreadGroup[],
  rng: RandomSource,
): TeamResult[] {
  const teams = targetSizes.map<TeamResult>((targetSize, teamIndex) => ({
    teamIndex,
    teamNumber: teamIndex + 1,
    targetSize,
    participantIds: [],
  }));
  const groupedMembers = new Set<string>();

  for (const plan of spreadPlan) {
    const members = shuffle(plan.memberIds, rng);
    let cursor = 0;

    for (let teamIndex = 0; teamIndex < teams.length; teamIndex += 1) {
      const count = plan.teamCounts[teamIndex];
      const chunk = members.slice(cursor, cursor + count);
      cursor += count;
      teams[teamIndex].participantIds.push(...chunk);
      chunk.forEach((memberId) => groupedMembers.add(memberId));
    }
  }

  const freeMembers = shuffle(
    participantIds.filter((participantId) => !groupedMembers.has(participantId)),
    rng,
  );
  const freeSlots = shuffle(
    teams.flatMap((team) =>
      Array.from(
        { length: team.targetSize - team.participantIds.length },
        () => team.teamIndex,
      ),
    ),
    rng,
  );

  if (freeSlots.length !== freeMembers.length) {
    throw new Error('남은 참가자와 팀 빈자리가 일치하지 않습니다.');
  }

  freeMembers.forEach((memberId, index) => {
    teams[freeSlots[index]].participantIds.push(memberId);
  });

  return teams.map((team) => ({
    ...team,
    participantIds: shuffle(team.participantIds, rng),
  }));
}

function assertAssignment(
  teams: TeamResult[],
  participantIds: string[],
  targetSizes: number[],
): void {
  const assignedIds = teams.flatMap((team) => team.participantIds);
  const uniqueIds = new Set(assignedIds);

  if (assignedIds.length !== participantIds.length) {
    throw new Error('배정된 참가자 수가 맞지 않습니다.');
  }

  if (uniqueIds.size !== assignedIds.length) {
    throw new Error('한 참가자가 둘 이상의 팀에 배정되었습니다.');
  }

  for (const participantId of participantIds) {
    if (!uniqueIds.has(participantId)) {
      throw new Error(`참가자 ${participantId} 배정이 누락되었습니다.`);
    }
  }

  const sizes = teams.map((team) => team.participantIds.length);
  const sizeSpread = Math.max(...sizes) - Math.min(...sizes);

  if (sizeSpread > 2) {
    throw new Error('팀별 인원 차이가 2명을 초과했습니다.');
  }

  if (sizeSpread > 1) {
    throw new Error('팀별 인원 차이가 기본 허용 범위인 1명을 초과했습니다.');
  }

  teams.forEach((team, index) => {
    if (team.participantIds.length !== targetSizes[index]) {
      throw new Error('팀 정원이 목표 크기와 일치하지 않습니다.');
    }
  });
}

function shuffle<T>(items: readonly T[], rng: RandomSource): T[] {
  const result = [...items];

  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(rng() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }

  return result;
}
