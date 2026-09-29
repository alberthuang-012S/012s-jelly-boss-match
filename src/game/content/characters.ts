import type { CharacterConfig, CharacterId, JellyColor } from '../types';

export const CHARACTERS: Record<CharacterId, CharacterConfig> = {
  PNN: { id: 'PNN', displayName: 'PNN', color: 'green', accent: '#82cf43', mainStats: ['Pai', 'Tum', 'Eye'], portrait: 'leaf-runner', title: '活力先鋒', symbol: 'P' },
  QCC: { id: 'QCC', displayName: 'QCC', color: 'purple', accent: '#aa80ef', mainStats: ['Bra', 'Eye', 'Vir'], portrait: 'star-keeper', title: '星光守護', symbol: 'Q' },
  REE: { id: 'REE', displayName: 'REE', color: 'red', accent: '#fa7167', mainStats: ['Sch', 'Neu', 'Pre'], portrait: 'ember-fighter', title: '烈焰鬥士', symbol: 'R' },
  KTT: { id: 'KTT', displayName: 'KTT', color: 'cyan', accent: '#42b9cb', mainStats: ['Vir', 'Tum', 'Bac'], portrait: 'sun-builder', title: '暖陽工匠', symbol: 'K' },
  COO: { id: 'COO', displayName: 'COO', color: 'yellow', accent: '#edc33f', mainStats: ['Pre', 'Bra', 'Pai'], portrait: 'halo-scout', title: '金光偵察', symbol: 'C' },
};

const COLOR_TO_CHARACTER = Object.fromEntries(Object.values(CHARACTERS).map((c) => [c.color, c.id])) as Record<JellyColor, CharacterId>;

export function characterForColor(color: JellyColor): CharacterConfig {
  return CHARACTERS[COLOR_TO_CHARACTER[color]];
}
