export interface CharacterOption {
  id: string;
  number: number;
  animal: string;
  shape: string;
  accent: string;
}

const animals = [
  '🐯',
  '🦁',
  '🐰',
  '🐻',
  '🐼',
  '🐨',
  '🦊',
  '🐺',
  '🐸',
  '🐵',
  '🐔',
  '🐧',
  '🦉',
  '🦆',
  '🐥',
  '🦄',
  '🐝',
  '🦋',
  '🐢',
  '🐬',
  '🐳',
  '🐙',
  '🦀',
  '🐠',
  '🐴',
  '🐷',
  '🐮',
  '🐑',
  '🐶',
  '🐱',
  '🐭',
  '🐹',
  '🦌',
  '🐘',
  '🦒',
  '🦓',
  '🦘',
  '🐫',
  '🦭',
  '🦖',
];

const shapes = ['●', '▲', '■', '◆', '★', '⬟', '✚', '♥'];
const accents = [
  '#e94f37',
  '#1f9d7a',
  '#3772ff',
  '#f6c85f',
  '#7b61ff',
  '#ef476f',
  '#118ab2',
  '#2f9e44',
];

export const characters: CharacterOption[] = animals.map((animal, index) => ({
  id: `character-${index + 1}`,
  number: index + 1,
  animal,
  shape: shapes[index % shapes.length],
  accent: accents[index % accents.length],
}));
