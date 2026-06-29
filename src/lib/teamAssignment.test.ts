import { describe, expect, it } from 'vitest';
import { assignTeams, getTeamSizeSpread, type SpreadGroupInput } from './teamAssignment';

function ids(count: number): string[] {
  return Array.from({ length: count }, (_, index) => `p-${index + 1}`);
}

function sortedMembers(assignment: ReturnType<typeof assignTeams>): string[] {
  return assignment.teams
    .flatMap((team) => team.participantIds)
    .sort((left, right) => left.localeCompare(right));
}

function groupCounts(
  assignment: ReturnType<typeof assignTeams>,
  memberIds: string[],
): number[] {
  const memberSet = new Set(memberIds);
  return assignment.teams.map(
    (team) => team.participantIds.filter((id) => memberSet.has(id)).length,
  );
}

describe('assignTeams', () => {
  it('keeps all team sizes within one person for 20 to 40 participants', () => {
    for (let participantCount = 20; participantCount <= 40; participantCount += 1) {
      for (let teamCount = 2; teamCount <= 8; teamCount += 1) {
        const participantIds = ids(participantCount);
        const assignment = assignTeams({
          participantIds,
          teamCount,
          seed: `size-${participantCount}-${teamCount}`,
        });

        expect(assignment.teams).toHaveLength(teamCount);
        expect(getTeamSizeSpread(assignment)).toBeLessThanOrEqual(1);
        expect(sortedMembers(assignment)).toEqual([...participantIds].sort());
      }
    }
  });

  it.each([
    [5, 4, [2, 1, 1, 1]],
    [7, 4, [2, 2, 2, 1]],
    [10, 4, [3, 3, 2, 2]],
  ])(
    'spreads a %i-person group across %i teams without increasing team count',
    (memberCount, teamCount, expectedCounts) => {
      const participantIds = ids(memberCount);
      const assignment = assignTeams({
        participantIds,
        teamCount,
        spreadGroups: [{ id: 'g-1', memberIds: participantIds }],
        seed: `spread-${memberCount}-${teamCount}`,
      });

      expect(assignment.teams).toHaveLength(teamCount);
      expect(groupCounts(assignment, participantIds).sort((a, b) => b - a)).toEqual(
        expectedCounts,
      );
    },
  );

  it('handles multiple spread groups at the same time', () => {
    const participantIds = ids(28);
    const groups: SpreadGroupInput[] = [
      { id: 'fast-runners', memberIds: participantIds.slice(0, 7) },
      { id: 'close-friends', memberIds: participantIds.slice(7, 17) },
      { id: 'new-students', memberIds: participantIds.slice(17, 22) },
    ];
    const assignment = assignTeams({
      participantIds,
      teamCount: 4,
      spreadGroups: groups,
      seed: 'multi-spread',
    });

    expect(getTeamSizeSpread(assignment)).toBeLessThanOrEqual(1);

    for (const group of groups) {
      const counts = groupCounts(assignment, group.memberIds);
      expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
    }
  });

  it('rejects overlapping spread group members', () => {
    expect(() =>
      assignTeams({
        participantIds: ids(20),
        teamCount: 4,
        spreadGroups: [
          { id: 'g-1', memberIds: ['p-1', 'p-2'] },
          { id: 'g-2', memberIds: ['p-2', 'p-3'] },
        ],
        seed: 'overlap',
      }),
    ).toThrow(/하나의 분산 그룹/);
  });

  it('keeps reroulette invariants while changing only the random assignment', () => {
    const participantIds = ids(32);
    const spreadGroups: SpreadGroupInput[] = [
      { id: 'g-1', memberIds: participantIds.slice(0, 6) },
      { id: 'g-2', memberIds: participantIds.slice(6, 13) },
    ];
    const spreadGroupSnapshot = structuredClone(spreadGroups);
    const first = assignTeams({
      participantIds,
      teamCount: 5,
      spreadGroups,
      seed: 'reroulette-1',
    });
    const second = assignTeams({
      participantIds,
      teamCount: 5,
      spreadGroups,
      seed: 'reroulette-2',
    });
    const repeatFirst = assignTeams({
      participantIds,
      teamCount: 5,
      spreadGroups,
      seed: 'reroulette-1',
    });

    expect(spreadGroups).toEqual(spreadGroupSnapshot);
    expect(sortedMembers(first)).toEqual(sortedMembers(second));
    expect(first.teams.map((team) => team.participantIds.length)).toEqual(
      second.teams.map((team) => team.participantIds.length),
    );
    expect(first).toEqual(repeatFirst);
    expect(first.teams.map((team) => team.participantIds)).not.toEqual(
      second.teams.map((team) => team.participantIds),
    );
  });
});
