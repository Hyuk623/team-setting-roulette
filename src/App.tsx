import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { characters, type CharacterOption } from './data/characters';
import {
  assignTeams,
  type TeamAssignment,
  type TeamResult,
} from './lib/teamAssignment';
import { clearSession, loadSession, saveSession } from './storage';
import type {
  AppPhase,
  ClassSettings,
  StoredSession,
  StoredSpreadGroup,
} from './types';

const MIN_SELECTED = 20;
const MAX_SELECTED = 40;

const teamMarks = [
  { shape: '●', color: '#e94f37' },
  { shape: '▲', color: '#1f9d7a' },
  { shape: '■', color: '#3772ff' },
  { shape: '◆', color: '#f6c85f' },
  { shape: '★', color: '#7b61ff' },
  { shape: '⬟', color: '#ef476f' },
  { shape: '✚', color: '#118ab2' },
  { shape: '♥', color: '#2f9e44' },
];

const defaultSession: StoredSession = {
  phase: 'setup',
  settings: { teamCount: 4 },
  selectedIds: [],
  spreadGroups: [],
  assignment: null,
  updatedAt: new Date().toISOString(),
};

function App() {
  const [session, setSession] = useState<StoredSession>(() => {
    const saved = loadSession();
    return saved ?? defaultSession;
  });
  const [activeGroupId, setActiveGroupId] = useState<string | null>(
    session.spreadGroups[0]?.id ?? null,
  );

  useEffect(() => {
    saveSession(session);
  }, [session]);

  const selectedCharacters = useMemo(
    () =>
      session.selectedIds
        .map((id) => characters.find((character) => character.id === id))
        .filter((character): character is CharacterOption => Boolean(character)),
    [session.selectedIds],
  );

  const characterById = useMemo(
    () => new Map(characters.map((character) => [character.id, character])),
    [],
  );

  const updateSession = (next: Partial<StoredSession>) => {
    setSession((current) => ({
      ...current,
      ...next,
    }));
  };

  const startClass = (settings: ClassSettings) => {
    updateSession({
      phase: 'select',
      settings,
      selectedIds: [],
      spreadGroups: [],
      assignment: null,
    });
    setActiveGroupId(null);
  };

  const toggleCharacter = (characterId: string) => {
    setSession((current) => {
      const isSelected = current.selectedIds.includes(characterId);
      const selectedIds = isSelected
        ? current.selectedIds.filter((id) => id !== characterId)
        : current.selectedIds.length < MAX_SELECTED
          ? [...current.selectedIds, characterId]
          : current.selectedIds;
      const selectedSet = new Set(selectedIds);

      return {
        ...current,
        selectedIds,
        assignment: null,
        spreadGroups: current.spreadGroups
          .map((group) => ({
            ...group,
            memberIds: group.memberIds.filter((id) => selectedSet.has(id)),
          }))
          .filter((group) => group.memberIds.length > 0),
      };
    });
  };

  const addSpreadGroup = () => {
    const groupId = `spread-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    setSession((current) => {
      const groupNumber = current.spreadGroups.length + 1;
      const group: StoredSpreadGroup = {
        id: groupId,
        label: `분산 ${groupNumber}`,
        memberIds: [],
      };

      return {
        ...current,
        spreadGroups: [...current.spreadGroups, group],
        assignment: null,
      };
    });
    setActiveGroupId(groupId);
  };

  const removeSpreadGroup = (groupId: string) => {
    setSession((current) => ({
      ...current,
      spreadGroups: current.spreadGroups.filter((group) => group.id !== groupId),
      assignment: null,
    }));

    if (activeGroupId === groupId) {
      setActiveGroupId(null);
    }
  };

  const toggleSpreadMember = (characterId: string) => {
    if (!activeGroupId) {
      return;
    }

    setSession((current) => ({
      ...current,
      assignment: null,
      spreadGroups: current.spreadGroups.map((group) => {
        const withoutMember = group.memberIds.filter((id) => id !== characterId);

        if (group.id !== activeGroupId) {
          return {
            ...group,
            memberIds: withoutMember,
          };
        }

        return {
          ...group,
          memberIds: group.memberIds.includes(characterId)
            ? withoutMember
            : [...withoutMember, characterId],
        };
      }),
    }));
  };

  const revealTeams = () => {
    const assignment = createAssignment(session);
    updateSession({
      phase: 'roulette',
      assignment,
    });
  };

  const finishRoulette = () => {
    updateSession({ phase: 'results' });
  };

  const reroulette = () => {
    const assignment = createAssignment(session);
    updateSession({
      phase: 'roulette',
      assignment,
    });
  };

  const endClass = () => {
    clearSession();
    setSession({
      ...defaultSession,
      updatedAt: new Date().toISOString(),
    });
    setActiveGroupId(null);
  };

  return (
    <main className="app-shell">
      <Header
        phase={session.phase}
        selectedCount={session.selectedIds.length}
        teamCount={session.settings.teamCount}
      />
      {session.phase === 'setup' && (
        <SetupScreen settings={session.settings} onStart={startClass} />
      )}
      {session.phase === 'select' && (
        <SelectionScreen
          selectedIds={session.selectedIds}
          onToggle={toggleCharacter}
          onBack={() => updateSession({ phase: 'setup' })}
          onNext={() => updateSession({ phase: 'groups' })}
        />
      )}
      {session.phase === 'groups' && (
        <SpreadGroupScreen
          activeGroupId={activeGroupId}
          groups={session.spreadGroups}
          selectedCharacters={selectedCharacters}
          teamCount={session.settings.teamCount}
          onActivateGroup={setActiveGroupId}
          onAddGroup={addSpreadGroup}
          onBack={() => updateSession({ phase: 'select' })}
          onRemoveGroup={removeSpreadGroup}
          onReveal={revealTeams}
          onToggleMember={toggleSpreadMember}
        />
      )}
      {session.phase === 'roulette' && session.assignment && (
        <RouletteScreen
          assignment={session.assignment}
          characterById={characterById}
          onDone={finishRoulette}
        />
      )}
      {session.phase === 'results' && session.assignment && (
        <ResultsScreen
          assignment={session.assignment}
          characterById={characterById}
          onEditGroups={() => updateSession({ phase: 'groups' })}
          onEndClass={endClass}
          onReroulette={reroulette}
        />
      )}
    </main>
  );
}

function Header({
  phase,
  selectedCount,
  teamCount,
}: {
  phase: AppPhase;
  selectedCount: number;
  teamCount: number;
}) {
  const phaseLabel: Record<AppPhase, string> = {
    setup: '수업 설정',
    select: '캐릭터 선택',
    groups: '강사용 분산 그룹',
    roulette: '룰렛 공개',
    results: '전체 팀 결과',
  };

  return (
    <header className="topbar">
      <div>
        <p className="eyebrow">어린이 체육수업</p>
        <h1>팀플레이 룰렛</h1>
      </div>
      <div className="status-strip" aria-label="현재 수업 상태">
        <span>{phaseLabel[phase]}</span>
        <span>{teamCount}팀</span>
        <span>{selectedCount}명</span>
      </div>
    </header>
  );
}

function SetupScreen({
  settings,
  onStart,
}: {
  settings: ClassSettings;
  onStart: (settings: ClassSettings) => void;
}) {
  const [teamCount, setTeamCount] = useState(settings.teamCount);

  return (
    <section className="setup-layout" aria-labelledby="setup-title">
      <div className="setup-copy">
        <p className="section-kicker">시작 및 수업 설정</p>
        <h2 id="setup-title">오늘 수업 팀 수</h2>
        <p className="screen-note">
          캐릭터 선택은 20명부터 시작할 수 있고 최대 40명까지 저장됩니다.
        </p>
      </div>
      <div className="setup-panel">
        <div className="team-count-grid" role="radiogroup" aria-label="팀 수">
          {Array.from({ length: 7 }, (_, index) => index + 2).map((count) => (
            <button
              className={count === teamCount ? 'count-button is-active' : 'count-button'}
              key={count}
              onClick={() => setTeamCount(count)}
              role="radio"
              aria-checked={count === teamCount}
              type="button"
            >
              <span className="team-shape" style={{ color: teamMarks[count - 2].color }}>
                {teamMarks[count - 2].shape}
              </span>
              {count}팀
            </button>
          ))}
        </div>
        <button
          className="primary-action"
          onClick={() => onStart({ teamCount })}
          type="button"
        >
          새 수업 시작
        </button>
      </div>
    </section>
  );
}

function SelectionScreen({
  selectedIds,
  onBack,
  onNext,
  onToggle,
}: {
  selectedIds: string[];
  onBack: () => void;
  onNext: () => void;
  onToggle: (characterId: string) => void;
}) {
  const selectedSet = new Set(selectedIds);
  const canContinue =
    selectedIds.length >= MIN_SELECTED && selectedIds.length <= MAX_SELECTED;

  return (
    <section className="screen-stack" aria-labelledby="select-title">
      <div className="screen-heading">
        <div>
          <p className="section-kicker">캐릭터 선택</p>
          <h2 id="select-title">한 번 터치로 선택</h2>
        </div>
        <strong className={canContinue ? 'count-pill is-ready' : 'count-pill'}>
          {selectedIds.length}/{MAX_SELECTED}
        </strong>
      </div>
      <CharacterGrid
        mode="select"
        selectedIds={selectedSet}
        characters={characters}
        onToggle={onToggle}
      />
      <div className="action-row">
        <button className="secondary-action" onClick={onBack} type="button">
          설정으로
        </button>
        <button
          className="primary-action"
          disabled={!canContinue}
          onClick={onNext}
          type="button"
        >
          선택 완료
        </button>
      </div>
    </section>
  );
}

function SpreadGroupScreen({
  activeGroupId,
  groups,
  selectedCharacters,
  teamCount,
  onActivateGroup,
  onAddGroup,
  onBack,
  onRemoveGroup,
  onReveal,
  onToggleMember,
}: {
  activeGroupId: string | null;
  groups: StoredSpreadGroup[];
  selectedCharacters: CharacterOption[];
  teamCount: number;
  onActivateGroup: (groupId: string | null) => void;
  onAddGroup: () => void;
  onBack: () => void;
  onRemoveGroup: (groupId: string) => void;
  onReveal: () => void;
  onToggleMember: (characterId: string) => void;
}) {
  const activeGroup = groups.find((group) => group.id === activeGroupId);
  const assignedGroupByMember = new Map<string, StoredSpreadGroup>();

  groups.forEach((group) => {
    group.memberIds.forEach((memberId) => {
      assignedGroupByMember.set(memberId, group);
    });
  });

  return (
    <section className="teacher-layout" aria-labelledby="group-title">
      <aside className="teacher-panel">
        <p className="section-kicker">강사용 화면</p>
        <h2 id="group-title">분산 그룹</h2>
        <p className="screen-note">{teamCount}팀 안에서 그룹별 인원을 균등 배치합니다.</p>
        <div className="group-list">
          {groups.map((group, index) => (
            <div
              className={group.id === activeGroupId ? 'group-row is-active' : 'group-row'}
              key={group.id}
            >
              <button onClick={() => onActivateGroup(group.id)} type="button">
                <span style={{ color: teamMarks[index % teamMarks.length].color }}>
                  {teamMarks[index % teamMarks.length].shape}
                </span>
                {group.label}
                <strong>{group.memberIds.length}명</strong>
              </button>
              <button
                aria-label={`${group.label} 삭제`}
                className="icon-action"
                onClick={() => onRemoveGroup(group.id)}
                type="button"
              >
                ×
              </button>
            </div>
          ))}
        </div>
        <button className="secondary-action full-width" onClick={onAddGroup} type="button">
          그룹 추가
        </button>
      </aside>
      <div className="group-workspace">
        <div className="screen-heading">
          <div>
            <p className="section-kicker">
              {activeGroup ? activeGroup.label : '그룹 없음'}
            </p>
            <h2>{activeGroup ? '포함할 캐릭터' : '그룹을 추가하세요'}</h2>
          </div>
          <strong className="count-pill">{selectedCharacters.length}명</strong>
        </div>
        <div className="character-grid group-grid">
          {selectedCharacters.map((character) => {
            const assignedGroup = assignedGroupByMember.get(character.id);
            const isActive = assignedGroup?.id === activeGroupId;

            return (
              <button
                className={[
                  'character-tile',
                  isActive ? 'is-selected' : '',
                  assignedGroup && !isActive ? 'is-muted' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                disabled={!activeGroupId}
                key={character.id}
                onClick={() => onToggleMember(character.id)}
                style={{ '--accent': character.accent } as CSSProperties}
                type="button"
              >
                <CharacterFace character={character} />
                {assignedGroup && (
                  <span className="group-badge">{assignedGroup.label}</span>
                )}
              </button>
            );
          })}
        </div>
        <div className="action-row">
          <button className="secondary-action" onClick={onBack} type="button">
            선택으로
          </button>
          <button className="primary-action" onClick={onReveal} type="button">
            룰렛 시작
          </button>
        </div>
      </div>
    </section>
  );
}

function RouletteScreen({
  assignment,
  characterById,
  onDone,
}: {
  assignment: TeamAssignment;
  characterById: Map<string, CharacterOption>;
  onDone: () => void;
}) {
  useEffect(() => {
    const timeoutId = window.setTimeout(onDone, 4300);
    return () => window.clearTimeout(timeoutId);
  }, [onDone]);

  const placements = useMemo(
    () => createRoulettePlacements(assignment),
    [assignment],
  );

  return (
    <section className="roulette-screen" aria-labelledby="roulette-title">
      <div className="screen-heading compact">
        <div>
          <p className="section-kicker">룰렛 애니메이션</p>
          <h2 id="roulette-title">팀 공개 중</h2>
        </div>
        <strong className="count-pill">{assignment.teams.length}팀</strong>
      </div>
      <div className="roulette-stage">
        <div
          className="team-lanes"
          style={{
            gridTemplateColumns: `repeat(${assignment.teamCount}, minmax(0, 1fr))`,
          }}
        >
          {assignment.teams.map((team) => (
            <div className="team-lane" key={team.teamIndex}>
              <span
                className="lane-mark"
                style={{ color: teamMarks[team.teamIndex].color }}
              >
                {team.teamNumber}{teamMarks[team.teamIndex].shape}
              </span>
            </div>
          ))}
        </div>
        {placements.map((placement) => {
          const character = characterById.get(placement.characterId);

          if (!character) {
            return null;
          }

          return (
            <div
              className="roulette-token"
              key={character.id}
              style={
                {
                  '--accent': character.accent,
                  '--spin-a-x': `${placement.spinA.x}%`,
                  '--spin-a-y': `${placement.spinA.y}%`,
                  '--spin-b-x': `${placement.spinB.x}%`,
                  '--spin-b-y': `${placement.spinB.y}%`,
                  '--to-x': `${placement.to.x}%`,
                  '--to-y': `${placement.to.y}%`,
                } as CSSProperties
              }
            >
              <CharacterFace character={character} compact />
            </div>
          );
        })}
      </div>
    </section>
  );
}

function ResultsScreen({
  assignment,
  characterById,
  onEditGroups,
  onEndClass,
  onReroulette,
}: {
  assignment: TeamAssignment;
  characterById: Map<string, CharacterOption>;
  onEditGroups: () => void;
  onEndClass: () => void;
  onReroulette: () => void;
}) {
  return (
    <section className="screen-stack" aria-labelledby="result-title">
      <div className="screen-heading">
        <div>
          <p className="section-kicker">전체 팀 결과</p>
          <h2 id="result-title">모든 팀 한눈에 보기</h2>
        </div>
        <strong className="count-pill">{assignment.seed.slice(-6)}</strong>
      </div>
      <div className="results-grid">
        {assignment.teams.map((team) => (
          <TeamResultCard
            characterById={characterById}
            key={team.teamIndex}
            team={team}
          />
        ))}
      </div>
      <div className="action-row">
        <button className="secondary-action" onClick={onEditGroups} type="button">
          분산 그룹
        </button>
        <button className="primary-action" onClick={onReroulette} type="button">
          재룰렛
        </button>
        <button className="danger-action" onClick={onEndClass} type="button">
          수업 종료
        </button>
      </div>
    </section>
  );
}

function TeamResultCard({
  characterById,
  team,
}: {
  characterById: Map<string, CharacterOption>;
  team: TeamResult;
}) {
  const mark = teamMarks[team.teamIndex];

  return (
    <article className="team-card">
      <header className="team-card-header">
        <span className="team-number" style={{ backgroundColor: mark.color }}>
          {team.teamNumber}
        </span>
        <div>
          <h3>{team.teamNumber}팀</h3>
          <p>
            <span style={{ color: mark.color }}>{mark.shape}</span> {team.participantIds.length}명
          </p>
        </div>
      </header>
      <div className="team-members">
        {team.participantIds.map((characterId) => {
          const character = characterById.get(characterId);

          if (!character) {
            return null;
          }

          return (
            <span
              className="member-chip"
              key={character.id}
              style={{ '--accent': character.accent } as CSSProperties}
            >
              <CharacterFace character={character} compact />
            </span>
          );
        })}
      </div>
    </article>
  );
}

function CharacterGrid({
  characters: characterList,
  mode,
  onToggle,
  selectedIds,
}: {
  characters: CharacterOption[];
  mode: 'select';
  onToggle: (characterId: string) => void;
  selectedIds: Set<string>;
}) {
  return (
    <div className="character-grid" data-mode={mode}>
      {characterList.map((character) => {
        const selected = selectedIds.has(character.id);

        return (
          <button
            className={selected ? 'character-tile is-selected' : 'character-tile'}
            key={character.id}
            onClick={() => onToggle(character.id)}
            style={{ '--accent': character.accent } as CSSProperties}
            type="button"
          >
            <CharacterFace character={character} />
          </button>
        );
      })}
    </div>
  );
}

function CharacterFace({
  character,
  compact = false,
}: {
  character: CharacterOption;
  compact?: boolean;
}) {
  return (
    <span className={compact ? 'character-face is-compact' : 'character-face'}>
      <span className="character-animal" aria-hidden="true">
        {character.animal}
      </span>
      <span className="character-meta">
        <span className="character-shape" aria-hidden="true">
          {character.shape}
        </span>
        <span>{String(character.number).padStart(2, '0')}</span>
      </span>
    </span>
  );
}

function createAssignment(session: StoredSession): TeamAssignment {
  return assignTeams({
    participantIds: session.selectedIds,
    teamCount: session.settings.teamCount,
    spreadGroups: session.spreadGroups,
    seed: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
  });
}

function createRoulettePlacements(assignment: TeamAssignment) {
  return assignment.teams.flatMap((team) =>
    team.participantIds.map((characterId, rowIndex) => {
      const rowRatio =
        team.participantIds.length <= 1
          ? 0.5
          : rowIndex / (team.participantIds.length - 1);
      const teamRatio = (team.teamIndex + 0.5) / assignment.teamCount;
      const ordinal = team.teamIndex * 11 + rowIndex * 7;

      return {
        characterId,
        to: {
          x: 5 + teamRatio * 90,
          y: 15 + rowRatio * 70,
        },
        spinA: {
          x: 50 + Math.cos(ordinal) * 32,
          y: 50 + Math.sin(ordinal) * 28,
        },
        spinB: {
          x: 50 + Math.sin(ordinal * 1.7) * 36,
          y: 50 + Math.cos(ordinal * 1.3) * 30,
        },
      };
    }),
  );
}

export default App;
