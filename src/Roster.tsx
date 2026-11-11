import { useState } from 'react';
import { characters } from './data/characters';

interface Entry { id: string; name: string }
interface RecordItem { id: string; title: string; entries: Entry[] }
const KEY = 'team-setting-saved-rosters';

export default function Roster({ ids, names, onLoad }: {
  ids: string[];
  names: Record<string, string>;
  onLoad: (ids: string[], names: Record<string, string>) => void;
}) {
  const [records, setRecords] = useState<RecordItem[]>(() => {
    try { return JSON.parse(localStorage.getItem(KEY) ?? '[]'); } catch { return []; }
  });
  const [title, setTitle] = useState('');
  const [active, setActive] = useState('');
  const [message, setMessage] = useState('');
  const [mode, setMode] = useState<'save' | 'load' | null>(null);
  const persist = (next: RecordItem[]) => {
    localStorage.setItem(KEY, JSON.stringify(next));
    setRecords(next);
  };
  const selected = records.find((record) => record.id === active);
  return <section className="saved-roster" aria-label="명단">
    <div className="action-row">
      <button type="button" className="secondary-action" disabled={!ids.length} onClick={() => setMode(mode === 'save' ? null : 'save')}>명단 저장</button>
      <button type="button" className="secondary-action" disabled={!records.length} onClick={() => setMode(mode === 'load' ? null : 'load')}>명단 불러오기</button>
      <button type="button" className="secondary-action" disabled={!ids.length} onClick={() => {
        if (window.confirm('현재 선택과 이름을 초기화할까요? 저장한 명단은 남아요.')) {
          onLoad([], {}); setMode(null); setMessage('현재 명단을 초기화했어요.');
        }
      }}>현재 명단 초기화</button>
    </div>
    {mode === 'save' && (
    <div className="action-row">
      <input aria-label="명단 이름" placeholder="명단 이름" maxLength={30} value={title} onChange={(event) => setTitle(event.target.value)} />
      <button type="button" className="secondary-action" disabled={!ids.length || !title.trim()} onClick={() => {
        const record = { id: crypto.randomUUID(), title: title.trim(), entries: ids.map((id) => ({ id, name: names[id] ?? '' })) };
        persist([...records, record]); setActive(record.id); setMode(null); setTitle(''); setMessage('명단을 저장했어요.');
      }}>현재 명단 저장</button>
    </div>)}
    {mode === 'load' && <div className="action-row">
      <select aria-label="저장된 명단 선택" value={active} onChange={(event) => setActive(event.target.value)}>
        <option value="">명단 선택</option>
        {records.map((record) => <option key={record.id} value={record.id}>{record.title} ({record.entries.length}명)</option>)}
      </select>
      <button type="button" className="secondary-action" disabled={!selected} onClick={() => {
        if (selected) { onLoad(selected.entries.map((entry) => entry.id), Object.fromEntries(selected.entries.map((entry) => [entry.id, entry.name]))); setMode(null); setMessage('명단을 불러왔어요.'); }
      }}>불러오기</button>
      <button type="button" className="danger-action" disabled={!selected} onClick={() => {
        if (selected && window.confirm(`${selected.title} 명단을 삭제할까요?`)) { persist(records.filter((record) => record.id !== active)); setActive(''); }
      }}>명단 삭제</button>
    </div>}
    {mode === 'load' && selected && <div className="roster-entries">{selected.entries.map((entry, index) => <div key={index}>
      <input aria-label={`${index + 1}번째 저장 이름`} value={entry.name} maxLength={12} onChange={(event) => persist(records.map((record) => record.id !== active ? record : { ...record, entries: record.entries.map((item, i) => i === index ? { ...item, name: event.target.value } : item) }))} />
      <select aria-label={`${index + 1}번째 캐릭터 변경`} value={entry.id} onChange={(event) => persist(records.map((record) => record.id !== active ? record : { ...record, entries: record.entries.map((item, i) => i === index ? { ...item, id: event.target.value } : item) }))}>
        {characters.map((character) => <option key={character.id} value={character.id} disabled={character.id !== entry.id && selected.entries.some((item) => item.id === character.id)}>{character.animal} {character.number}</option>)}
      </select>
    </div>)}</div>}
    <span role="status">{message}</span>
  </section>;
}
