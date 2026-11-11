import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { characters, type CharacterOption } from './data/characters';
import {
  assignTeams,
  type TeamAssignment,
  type TeamResult,
} from './lib/teamAssignment';
import { clearSession, loadSession, saveSession } from './storage';
import Roster from './Roster';
import type {
  AppPhase,
  ClassSettings,
  StoredSession,
  StoredSpreadGroup,
} from './types';

const MIN_SELECTED = 2;
const MAX_SELECTED = 40;
const MAX_NAME_LENGTH = 12;

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
  characterNames: {},
  spreadGroups: [],
  assignment: null,
  updatedAt: new Date().toISOString(),
};

function App() {
  const [session, setSession] = useState<StoredSession>(() => {
    const saved = loadSession();
    return saved ? { ...defaultSession, ...saved, characterNames: saved.characterNames ?? {} } : defaultSession;
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

  const updateTeamCount = (teamCount: number) => {
    setSession((current) => ({
      ...current,
      settings: { ...current.settings, teamCount },
      assignment: null,
    }));
  };

  const startClass = (settings: ClassSettings) => {
    updateSession({
      phase: 'select',
      settings,
      selectedIds: [],
      characterNames: {},
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
      const characterNames = Object.fromEntries(
        Object.entries(current.characterNames ?? {}).filter(([id]) => selectedSet.has(id)),
      );

      return {
        ...current,
        selectedIds,
        characterNames,
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

  const updateCharacterName = (characterId: string, name: string) => {
    const trimmedValue = name.slice(0, MAX_NAME_LENGTH);

    setSession((current) => ({
      ...current,
      characterNames: {
        ...(current.characterNames ?? {}),
        [characterId]: trimmedValue,
      },
    }));
  };

  const addSpreadGroup = () => {
    const groupId = `spread-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    setSession((current) => {
      const groupNumber = current.spreadGroups.length + 1;
      const group: StoredSpreadGroup = {
        id: groupId,
        label: `묶음 ${groupNumber}`,
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
        <>
        <Roster ids={session.selectedIds} names={session.characterNames ?? {}} onLoad={(selectedIds, characterNames) => {
          updateSession({ selectedIds, characterNames, spreadGroups: [], assignment: null });
          setActiveGroupId(null);
        }} />
        <SelectionScreen
          characterNames={session.characterNames ?? {}}
          selectedIds={session.selectedIds}
          teamCount={session.settings.teamCount}
          onChangeName={updateCharacterName}
          onChangeTeamCount={updateTeamCount}
          onToggle={toggleCharacter}
          onBack={() => updateSession({ phase: 'setup' })}
          onNext={() => updateSession({ phase: 'groups' })}
        />
        </>
      )}
      {session.phase === 'groups' && (
        <SpreadGroupScreen
          activeGroupId={activeGroupId}
          characterNames={session.characterNames ?? {}}
          groups={session.spreadGroups}
          selectedCharacters={selectedCharacters}
          teamCount={session.settings.teamCount}
          onActivateGroup={setActiveGroupId}
          onAddGroup={addSpreadGroup}
          onBack={() => updateSession({ phase: 'select' })}
          onChangeTeamCount={updateTeamCount}
          onRemoveGroup={removeSpreadGroup}
          onReveal={revealTeams}
          onToggleMember={toggleSpreadMember}
        />
      )}
      {session.phase === 'roulette' && session.assignment && (
        <RouletteScreen
          assignment={session.assignment}
          characterById={characterById}
          characterNames={session.characterNames ?? {}}
          onDone={finishRoulette}
        />
      )}
      {session.phase === 'results' && session.assignment && (
        <ResultsScreen
          assignment={session.assignment}
          characterById={characterById}
          characterNames={session.characterNames ?? {}}
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
    setup: '팀 설정',
    select: '캐릭터 선택',
    groups: '같은 팀 피하기',
    roulette: '룰렛 공개',
    results: '전체 팀 결과',
  };

  return (
    <header className="topbar">
      <div>
        <h1>팀 세팅 룰렛</h1>
      </div>
      <div className="status-strip" aria-label="현재 진행 상태">
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
        <p className="section-kicker">팀 설정</p>
        <h2 id="setup-title">오늘 몇 팀으로 나눌까요?</h2>
        <p className="screen-note">
          팀 수는 언제든 다시 바꿀 수 있어요. 참여자는 2명부터 40명까지 캐릭터를 골라 참여합니다.
        </p>
      </div>
      <div className="setup-panel">
        <TeamCountControl value={teamCount} onChange={setTeamCount} size="large" />
        <button
          className="primary-action full-width"
          onClick={() => onStart({ teamCount })}
          type="button"
        >
          캐릭터 고르러 가기
        </button>
      </div>
    </section>
  );
}

function TeamCountControl({
  onChange,
  size = 'compact',
  value,
}: {
  onChange: (teamCount: number) => void;
  size?: 'compact' | 'large';
  value: number;
}) {
  const changeBy = (delta: number) => {
    onChange(Math.min(8, Math.max(2, value + delta)));
  };

  return (
    <div className={size === 'large' ? 'settings-control is-large' : 'settings-control'}>
      <div className="stepper-row" aria-label="팀 수 조절">
        <button
          className="stepper-button"
          disabled={value <= 2}
          onClick={() => changeBy(-1)}
          type="button"
          aria-label="팀 수 줄이기"
        >
          −
        </button>
        <strong className="team-count-display">
          <span>{value}</span>팀
        </strong>
        <button
          className="stepper-button"
          disabled={value >= 8}
          onClick={() => changeBy(1)}
          type="button"
          aria-label="팀 수 늘리기"
        >
          +
        </button>
      </div>
      <div className="team-count-grid" role="radiogroup" aria-label="팀 수 빠른 선택">
        {Array.from({ length: 7 }, (_, index) => index + 2).map((count) => (
          <button
            className={count === value ? 'count-button is-active' : 'count-button'}
            key={count}
            onClick={() => onChange(count)}
            role="radio"
            aria-checked={count === value}
            type="button"
          >
            <span className="team-shape" style={{ color: teamMarks[count - 2].color }}>
              {teamMarks[count - 2].shape}
            </span>
            {count}팀
          </button>
        ))}
      </div>
    </div>
  );
}

function SelectionScreen({
  characterNames,
  selectedIds,
  teamCount,
  onBack,
  onChangeName,
  onChangeTeamCount,
  onNext,
  onToggle,
}: {
  characterNames: Record<string, string>;
  selectedIds: string[];
  teamCount: number;
  onBack: () => void;
  onChangeName: (characterId: string, name: string) => void;
  onChangeTeamCount: (teamCount: number) => void;
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
          <h2 id="select-title">내 캐릭터를 고르고 이름을 적어요</h2>
        </div>
        <div className="heading-tools">
          <MiniSettings teamCount={teamCount} onChangeTeamCount={onChangeTeamCount} />
          <strong className={canContinue ? 'count-pill is-ready' : 'count-pill'}>
            {selectedIds.length}/{MAX_SELECTED}명
          </strong>
        </div>
      </div>
      <CharacterGrid
        characterNames={characterNames}
        selectedIds={selectedSet}
        characters={characters}
        onChangeName={onChangeName}
        onToggle={onToggle}
      />
      <div className="action-row">
        <button className="secondary-action" onClick={onBack} type="button">
          처음 설정
        </button>
        <button
          className="primary-action"
          disabled={!canContinue}
          onClick={onNext}
          type="button"
        >
          캐릭터 선택 완료
        </button>
      </div>
    </section>
  );
}

function MiniSettings({
  onChangeTeamCount,
  teamCount,
}: {
  onChangeTeamCount: (teamCount: number) => void;
  teamCount: number;
}) {
  return (
    <div className="mini-settings" aria-label="팀 수 바로 바꾸기">
      <span>팀 수</span>
      <TeamCountControl value={teamCount} onChange={onChangeTeamCount} />
    </div>
  );
}

function SpreadGroupScreen({
  activeGroupId,
  characterNames,
  groups,
  selectedCharacters,
  teamCount,
  onActivateGroup,
  onAddGroup,
  onBack,
  onChangeTeamCount,
  onRemoveGroup,
  onReveal,
  onToggleMember,
}: {
  activeGroupId: string | null;
  characterNames: Record<string, string>;
  groups: StoredSpreadGroup[];
  selectedCharacters: CharacterOption[];
  teamCount: number;
  onActivateGroup: (groupId: string | null) => void;
  onAddGroup: () => void;
  onBack: () => void;
  onChangeTeamCount: (teamCount: number) => void;
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
        <p className="section-kicker">선생님 설정</p>
        <h2 id="group-title">같은 팀 피하기</h2>
        <p className="screen-note">
          같이 붙으면 안 되는 캐릭터들을 한 묶음에 넣어 주세요. 룰렛이 가능한 서로 다른 팀으로 보내요.
        </p>
        <MiniSettings teamCount={teamCount} onChangeTeamCount={onChangeTeamCount} />
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
          피할 묶음 추가
        </button>
      </aside>
      <div className="group-workspace">
        <div className="screen-heading">
          <div>
            <p className="section-kicker">
              {activeGroup ? activeGroup.label : '묶음 없음'}
            </p>
            <h2>{activeGroup ? '서로 떨어뜨릴 캐릭터' : '묶음을 먼저 추가하세요'}</h2>
          </div>
          <strong className="count-pill">{selectedCharacters.length}명</strong>
        </div>
        <div className="teacher-help-strip">
          <span>예: 친한 친구들, 실력이 비슷한 친구들, 계속 같은 편이 되는 친구들</span>
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
                <CharacterFace character={character} name={characterNames[character.id]} />
                {assignedGroup && (
                  <span className="group-badge">{assignedGroup.label}</span>
                )}
              </button>
            );
          })}
        </div>
        <div className="action-row">
          <button className="secondary-action" onClick={onBack} type="button">
            캐릭터 다시 고르기
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
  characterNames,
  onDone,
}: {
  assignment: TeamAssignment;
  characterById: Map<string, CharacterOption>;
  characterNames: Record<string, string>;
  onDone: () => void;
}) {
  useEffect(() => {
    const timeoutId = window.setTimeout(onDone, 7200);
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
          <h2 id="roulette-title">내 캐릭터가 어디로 갈까요?</h2>
        </div>
        <strong className="count-pill">{assignment.teams.length}팀</strong>
      </div>
      <div className="roulette-stage">
        <div className="stage-callout">들어갈까? 말까?</div>
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
              <span
                className="team-gate"
                style={{ borderColor: teamMarks[team.teamIndex].color }}
              >
                {team.teamNumber}팀 입구
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
                  '--delay': `${placement.delay}ms`,
                  '--spin-a-x': `${placement.spinA.x}%`,
                  '--spin-a-y': `${placement.spinA.y}%`,
                  '--spin-b-x': `${placement.spinB.x}%`,
                  '--spin-b-y': `${placement.spinB.y}%`,
                  '--near-x': `${placement.near.x}%`,
                  '--near-y': `${placement.near.y}%`,
                  '--peek-x': `${placement.peek.x}%`,
                  '--peek-y': `${placement.peek.y}%`,
                  '--to-x': `${placement.to.x}%`,
                  '--to-y': `${placement.to.y}%`,
                } as CSSProperties
              }
            >
              <CharacterFace character={character} compact name={characterNames[character.id]} />
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
  characterNames,
  onEditGroups,
  onEndClass,
  onReroulette,
}: {
  assignment: TeamAssignment;
  characterById: Map<string, CharacterOption>;
  characterNames: Record<string, string>;
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
            characterNames={characterNames}
            key={team.teamIndex}
            team={team}
          />
        ))}
      </div>
      <div className="action-row">
        <button className="secondary-action" onClick={onEditGroups} type="button">
          같은 팀 피하기
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
  characterNames,
  team,
}: {
  characterById: Map<string, CharacterOption>;
  characterNames: Record<string, string>;
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
              <CharacterFace character={character} compact name={characterNames[character.id]} />
            </span>
          );
        })}
      </div>
    </article>
  );
}

function CharacterGrid({
  characterNames,
  characters: characterList,
  onChangeName,
  onToggle,
  selectedIds,
}: {
  characterNames: Record<string, string>;
  characters: CharacterOption[];
  onChangeName: (characterId: string, name: string) => void;
  onToggle: (characterId: string) => void;
  selectedIds: Set<string>;
}) {
  return (
    <div className="character-grid" data-mode="select">
      {characterList.map((character) => {
        const selected = selectedIds.has(character.id);

        return (
          <div
            className={selected ? 'character-pick is-selected' : 'character-pick'}
            key={character.id}
            style={{ '--accent': character.accent } as CSSProperties}
          >
            <button
              className={selected ? 'character-tile is-selected' : 'character-tile'}
              onClick={() => onToggle(character.id)}
              type="button"
            >
              <CharacterFace character={character} name={characterNames[character.id]} />
            </button>
            {selected && (
              <label className="name-field">
                <span>이름</span>
                <input
                  aria-label={`${character.number}번 캐릭터 이름`}
                  maxLength={MAX_NAME_LENGTH}
                  onChange={(event) => onChangeName(character.id, event.target.value)}
                  placeholder="이름"
                  type="text"
                  value={characterNames[character.id] ?? ''}
                />
              </label>
            )}
          </div>
        );
      })}
    </div>
  );
}

function CharacterFace({
  character,
  compact = false,
  name,
}: {
  character: CharacterOption;
  compact?: boolean;
  name?: string;
}) {
  const trimmedName = name?.trim();

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
      {trimmedName && <span className="character-name">{trimmedName}</span>}
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
      const targetX = 5 + teamRatio * 90;
      const targetY = 18 + rowRatio * 66;
      const side = team.teamIndex % 2 === 0 ? -1 : 1;

      return {
        characterId,
        delay: (rowIndex % 6) * 90 + team.teamIndex * 55,
        to: {
          x: targetX,
          y: targetY,
        },
        near: {
          x: targetX + side * 5,
          y: Math.max(14, targetY - 8),
        },
        peek: {
          x: targetX - side * 4,
          y: Math.min(86, targetY + 5),
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
