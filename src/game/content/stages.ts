import type { StageConfig } from '../types';

export const CHAPTERS = [
  { id: 1, title: '水母小隊集合！' },
  { id: 2, title: '全新的怪獸挑戰' },
  { id: 3, title: '護盾要塞' },
  { id: 4, title: '迷霧森林' },
] as const;

export const STAGES: StageConfig[] = [
  { id: '1-1', chapter: 1, number: 1, title: '細菌怪出沒', enemyId: 'bacteria', difficulty: 1 },
  { id: '1-2', chapter: 1, number: 2, title: '噴嚏雲來了', enemyId: 'cold', difficulty: 1 },
  { id: '1-3', chapter: 1, number: 3, title: '打起精神！', enemyId: 'sleepy', difficulty: 2 },
  { id: '1-4', chapter: 1, number: 4, title: '穿越迷霧', enemyId: 'blur', difficulty: 2 },
  { id: '2-1', chapter: 2, number: 1, title: '健忘怪來襲', enemyId: 'forgetful', difficulty: 2 },
  { id: '2-2', chapter: 2, number: 2, title: '黏液大堵塞', enemyId: 'slime', difficulty: 3 },
  { id: '2-3', chapter: 2, number: 3, title: '石巨像甦醒', enemyId: 'joint', difficulty: 3 },
  { id: '2-4', chapter: 2, number: 4, title: '三頭來襲', enemyId: 'three-high', difficulty: 3 },
  { id: '3-1', chapter: 3, number: 1, title: '要塞前哨', enemyId: 'shield-scout', difficulty: 2 },
  { id: '3-2', chapter: 3, number: 2, title: '護盾輪替', enemyId: 'shield-slime', difficulty: 2 },
  { id: '3-3', chapter: 3, number: 3, title: '石門守衛', enemyId: 'stone-guard', difficulty: 3 },
  { id: '3-4', chapter: 3, number: 4, title: '甲殼之心', enemyId: 'shell-warden', difficulty: 3 },
  { id: '4-1', chapter: 4, number: 1, title: '林間薄霧', enemyId: 'mist-sprite', difficulty: 2 },
  { id: '4-2', chapter: 4, number: 2, title: '黏液小徑', enemyId: 'forest-slime', difficulty: 2 },
  { id: '4-3', chapter: 4, number: 3, title: '藤蔓迷陣', enemyId: 'vine-guard', difficulty: 3 },
  { id: '4-4', chapter: 4, number: 4, title: '霧林深處', enemyId: 'forest-beast', difficulty: 3 },
];
