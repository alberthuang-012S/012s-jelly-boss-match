import type { CharacterId, CharacterSkillConfig } from '../types';

/** Single source of truth for each character's charge cost and skill copy. */
export const CHARACTER_SKILLS: Record<CharacterId, CharacterSkillConfig> = {
  PNN: { id: 'PNN', name: '活力補給', chargeCost: 10, effectText: '回復 20 HP（不超過最大 HP）', icon: '＋' },
  QCC: { id: 'QCC', name: '星光干擾', chargeCost: 12, effectText: '立即取消 Boss 正在蓄力的強招', icon: '✧' },
  REE: { id: 'REE', name: '烈焰增幅', chargeCost: 10, effectText: '下一次有效交換的傷害 ×1.25，可與連鎖倍率相乘', icon: '火' },
  KTT: { id: 'KTT', name: '水波破盾', chargeCost: 8, effectText: '移除敵人最多 30 點護盾，不造成 HP 傷害', icon: '≈' },
  COO: { id: 'COO', name: '金光淨化', chargeCost: 10, effectText: '清除迷霧與問號，所有鎖定格各減少 1 層', icon: '✦' },
};
