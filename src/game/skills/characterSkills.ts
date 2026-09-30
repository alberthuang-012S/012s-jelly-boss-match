import { CHARACTER_IDS } from '../types';
import type { BattleEvent, BattleState, CharacterCharges, CharacterId, TurnResolution } from '../types';
import { CHARACTER_SKILLS } from '../content/skills';
import { GAME_CONFIG } from '../config/gameConfig';

export function emptyCharacterCharges(): CharacterCharges {
  return Object.fromEntries(CHARACTER_IDS.map((id) => [id, 0])) as CharacterCharges;
}

export function skillUnavailableReason(battle: BattleState, characterId: CharacterId): string | null {
  if (battle.status !== 'playing') return '戰鬥已結束';
  if (battle.skillUsedSinceSwap) return '每次有效交換之間只能施放一項技能';
  const skill = CHARACTER_SKILLS[characterId];
  if (battle.characterCharges[characterId] < skill.chargeCost) return `充能不足（${battle.characterCharges[characterId]} / ${skill.chargeCost}）`;
  switch (characterId) {
    case 'PNN': return battle.playerHp >= GAME_CONFIG.playerMaxHp ? '小隊 HP 已滿，暫時無需補給' : null;
    case 'QCC': return battle.enemy.type === 'boss' && battle.bossCharge ? null : '目前沒有正在蓄力的 Boss 強招';
    case 'REE': return battle.reeBoostPending ? '烈焰增幅已待命，不能疊加' : null;
    case 'KTT': return battle.enemyShield > 0 ? null : '敵人目前沒有護盾';
    case 'COO':
      return battle.board.some((row) => row.some((tile) => tile && (tile.fog || tile.lockHits))) ? null : '盤面目前沒有可淨化的迷霧或鎖定';
  }
  return null;
}

export function useCharacterSkill(battle: BattleState, characterId: CharacterId): TurnResolution {
  const reason = skillUnavailableReason(battle, characterId);
  if (reason) return { accepted: false, battle, events: [] };

  const skill = CHARACTER_SKILLS[characterId];
  const chargeAfter = battle.characterCharges[characterId] - skill.chargeCost;
  const characterCharges = { ...battle.characterCharges, [characterId]: chargeAfter };
  const events: BattleEvent[] = [{ type: 'SKILL_USED', characterId, skillName: skill.name, chargeAfter }];
  let next: BattleState = { ...battle, characterCharges, skillUsedSinceSwap: true };

  switch (characterId) {
    case 'PNN': {
      const playerHp = Math.min(GAME_CONFIG.playerMaxHp, battle.playerHp + 20);
      events.push({ type: 'PLAYER_HEAL', amount: playerHp - battle.playerHp, playerHp });
      next = { ...next, playerHp };
      break;
    }
    case 'QCC':
      events.push({ type: 'BOSS_BREAK', source: 'skill' });
      next = { ...next, bossCharge: null };
      break;
    case 'REE':
      events.push({ type: 'REE_BOOST_READY' });
      next = { ...next, reeBoostPending: true };
      break;
    case 'KTT': {
      const amount = Math.min(30, battle.enemyShield);
      const enemyShield = battle.enemyShield - amount;
      events.push({ type: 'ENEMY_SHIELD_DAMAGE', amount, enemyShield });
      next = { ...next, enemyShield };
      break;
    }
    case 'COO': {
      const board = battle.board.map((row) => row.map((tile) => {
        if (!tile) return null;
        const clean = { ...tile };
        delete clean.fog;
        if (clean.lockHits) {
          clean.lockHits -= 1;
          if (clean.lockHits <= 0) delete clean.lockHits;
        }
        return clean;
      }));
      events.push({ type: 'BOARD_EFFECT', board: board.map((row) => row.map((tile) => tile ? { ...tile } : null)), message: '金光淨化！迷霧清除，鎖定減弱' });
      next = { ...next, board };
      break;
    }
  }

  return { accepted: true, battle: next, events };
}
