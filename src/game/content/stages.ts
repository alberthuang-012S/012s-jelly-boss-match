import type { StageConfig } from '../types';

export const STAGES: StageConfig[] = [
  { id: '1-1', chapter: 1, number: 1, title: '細菌怪出沒', enemyId: 'bacteria', difficulty: 1 },
  { id: '1-2', chapter: 1, number: 2, title: '噴嚏雲來了', enemyId: 'cold', difficulty: 1 },
  { id: '1-3', chapter: 1, number: 3, title: '打起精神！', enemyId: 'sleepy', difficulty: 2 },
  { id: '1-4', chapter: 1, number: 4, title: '穿越迷霧', enemyId: 'blur', difficulty: 2 },
  { id: '2-1', chapter: 2, number: 1, title: '問號滿天飛', enemyId: 'forgetful', difficulty: 2 },
  { id: '2-2', chapter: 2, number: 2, title: '黏液大堵塞', enemyId: 'slime', difficulty: 3 },
  { id: '2-3', chapter: 2, number: 3, title: '石巨像甦醒', enemyId: 'joint', difficulty: 3 },
  { id: '2-4', chapter: 2, number: 4, title: '三頭來襲', enemyId: 'three-high', difficulty: 3 },
];
