import type { EnemyConfig } from '../types';

export const ENEMIES: Record<string, EnemyConfig> = {
  bacteria: { id: 'bacteria', name: '細菌怪小隊', type: 'normal', kind: 'bacteria', maxHp: 150, attackPattern: [{ type: 'attack', amount: 8 }, { type: 'blocker', amount: 1 }], asset: 'bacteria', tagline: '吵鬧黏人的小怪群' },
  cold: { id: 'cold', name: '噴嚏雲怪', type: 'normal', kind: 'cold', maxHp: 185, attackPattern: [{ type: 'fog', amount: 2 }, { type: 'attack', amount: 10 }], asset: 'cold', tagline: '呼——霧氣來了！' },
  sleepy: { id: 'sleepy', name: '沒精神怪', type: 'normal', kind: 'sleepy', maxHp: 210, attackPattern: [{ type: 'darken', turns: 1 }, { type: 'attack', amount: 10 }], asset: 'sleepy', tagline: '呵啊……好想睡……' },
  forgetful: { id: 'forgetful', name: '健忘怪', type: 'normal', kind: 'forgetful', maxHp: 220, attackPattern: [{ type: 'confuse', amount: 3 }, { type: 'attack', amount: 10 }], asset: 'forgetful', tagline: '咦？剛才要做什麼？' },
  blur: { id: 'blur', name: '眼睛模糊怪', type: 'boss', kind: 'blur', maxHp: 560, attackPattern: [{ type: 'fog', amount: 3 }, { type: 'attack', amount: 15 }, { type: 'fog', amount: 2 }], statMultipliers: { Eye: 1.2, Pai: 0.9 }, asset: 'blur', tagline: '濃霧遮不住你的眼力！' },
  'three-high': { id: 'three-high', name: '三高怪', type: 'boss', kind: 'three-high', maxHp: 650, attackPattern: [{ type: 'blocker', amount: 2 }, { type: 'shield', amount: 24 }, { type: 'attack', amount: 17 }], statMultipliers: { Tum: 1.15, Bac: 0.9 }, asset: 'three-high', tagline: '三個頭，三種麻煩！' },
  slime: { id: 'slime', name: '黏液怪', type: 'normal', kind: 'slime', maxHp: 320, attackPattern: [{ type: 'slime', amount: 2 }, { type: 'attack', amount: 12 }], statMultipliers: { Vir: 1.15 }, asset: 'slime', tagline: '黏液格可用鄰近消除解除' },
  joint: { id: 'joint', name: '關節痠痛巨像', type: 'boss', kind: 'joint', maxHp: 740, attackPattern: [{ type: 'stone', amount: 2 }, { type: 'attack', amount: 18 }, { type: 'shield', amount: 20 }], statMultipliers: { Bac: 1.2, Sch: 0.9 }, asset: 'joint', tagline: '擊碎石化格，打破僵局！' },
};
