import { useLayoutEffect, useRef, type CSSProperties } from 'react';
import { CHARACTERS } from '../game/content/characters';
import { CHARACTER_IDS, type BossChargeState, type CharacterCharges, type CharacterId, type EnemyConfig } from '../game/types';
import { CHARACTER_SKILLS } from '../game/content/skills';
import { CharacterArt, EnemyArt } from './GameArt';
import './Battlefield.css';

export type StrikeState = {
  phase: 'idle' | 'charge' | 'rush' | 'impact' | 'recover' | 'enemy' | 'boss-break';
  fast: boolean;
  attackers: CharacterId[];
  hit: { damage: number; shieldDamage: number; shieldBroken: boolean } | null;
  chainWaves: number;
};

export const idleStrike: StrikeState = { phase: 'idle', fast: false, attackers: [], hit: null, chainWaves: 0 };

const formation = [
  { x: 26, y: 47, targetX: 65, targetY: 46 },
  { x: 7, y: 29, targetX: 59, targetY: 29 },
  { x: 9, y: 64, targetX: 60, targetY: 60 },
  { x: 21, y: 17, targetX: 68, targetY: 19 },
  { x: 24, y: 76, targetX: 68, targetY: 72 },
];

type Props = {
  enemy: EnemyConfig;
  hp: number;
  shield: number;
  nextAction: string;
  bossCharge: BossChargeState | null;
  turn: number;
  status: string;
  cue: string;
  activeCharacter: CharacterId | null;
  charges: CharacterCharges;
  skillsDisabled: boolean;
  onSkillSelect: (characterId: CharacterId) => void;
  strike: StrikeState;
  playerHurt: boolean;
  paused: boolean;
  skipping: boolean;
};

export function Battlefield({ enemy, hp, shield, nextAction, bossCharge, turn, status, cue, activeCharacter, charges, skillsDisabled, onSkillSelect, strike, playerHurt, paused, skipping }: Props) {
  const fieldRef = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    fieldRef.current?.getAnimations({ subtree: true }).forEach((animation) => {
      if (paused) animation.pause();
      else if (animation.playState === 'paused') animation.play();
    });
  }, [paused, strike.phase]);
  const percent = Math.max(0, Math.min(100, hp / enemy.maxHp * 100));
  const hitting = strike.phase === 'impact' || strike.phase === 'recover';
  return <section ref={fieldRef} className={`battlefield battlefield--${strike.phase} battlefield--chain-${strike.chainWaves}${bossCharge ? ' battlefield--charging' : ''}${strike.fast ? ' battlefield--fast' : ''}${playerHurt ? ' battlefield--player-hit' : ''}${paused ? ' battlefield--paused' : ''}${skipping ? ' battlefield--skip' : ''}`} aria-label="小隊戰場">
    <header className="battlefield-hud">
      <div className="battlefield-title"><span>{enemy.type === 'boss' ? 'BOSS BATTLE' : 'JELLY SQUAD'}</span></div>
      <div className="battlefield-vitals">
        <div className="battlefield-hp-label"><span>敵人 HP</span><b>{hp}<small> / {enemy.maxHp}</small></b></div>
        <div className="battlefield-hp" role="progressbar" aria-label="敵人 HP" aria-valuemin={0} aria-valuemax={enemy.maxHp} aria-valuenow={hp}>
          <span className="battlefield-hp-trail" style={{ width: `${percent}%` }} />
          <span className="battlefield-hp-fill" style={{ width: `${percent}%` }} />
        </div>
        <span className="battlefield-shield">{shield > 0 ? `✧ 護盾 ${shield}` : ' '}</span>
      </div>
    </header>

    <div className="battlefield-scene">
      <div className="battlefield-horizon" aria-hidden="true" />
      <div className="battlefield-floor" aria-hidden="true" />
      <span className="battlefield-side" aria-hidden="true">012S SQUAD</span>
      <span className="battlefield-cue" role="status">{cue}</span>
      <div className="battlefield-enemy">
        <div className="battlefield-enemy-shadow" />
        <EnemyArt kind={enemy.kind} hurt={hitting} />
        <h1 className="battlefield-enemy-name">{enemy.name}</h1>
      </div>

      {CHARACTER_IDS.map((id, index) => {
        const slot = formation[index]!;
        const attacking = strike.attackers.includes(id);
        const skill = CHARACTER_SKILLS[id];
        const charge = charges[id];
        const chargePercent = Math.min(100, charge / skill.chargeCost * 100);
        const style = {
          '--home-x': `${slot.x}%`, '--home-y': `${slot.y}%`,
          '--target-x': `${slot.targetX}%`, '--target-y': `${slot.targetY}%`,
          '--accent': CHARACTERS[id].accent, '--idle-delay': `${index * -.37}s`,
          '--charge-progress': `${chargePercent}%`,
          zIndex: 3 + index,
        } as CSSProperties;
        return <button key={id} type="button" style={style} disabled={skillsDisabled} onClick={() => onSkillSelect(id)} aria-label={`${id} ${skill.name}，充能 ${charge} / ${skill.chargeCost}，Enter 或 Space 開啟技能`} className={`battlefield-hero${attacking ? ' battlefield-hero--attacking' : ''}${activeCharacter === id ? ' battlefield-hero--energized' : ''}${chargePercent >= 100 ? ' battlefield-hero--charged' : ''}`}>
          <span className="battlefield-hero-shadow" aria-hidden="true" />
          <span className="battlefield-trail" aria-hidden="true" />
          <span className="battlefield-hero-art"><CharacterArt id={id} /></span>
          <span className="battlefield-hero-name">{id}</span>
          <span className="battlefield-charge-ring" aria-hidden="true"><i>{chargePercent >= 100 ? skill.icon : ''}</i></span>
        </button>;
      })}

      {strike.hit && <div className="battlefield-impact" aria-hidden="true"><i /><i /><i /><i /><b>✦</b></div>}
      {strike.hit && <div className="battlefield-damage" role="status">
        <span>{strike.hit.shieldBroken ? '破盾！' : 'HIT!'}</span>
        <strong>{strike.hit.damage}</strong>
        {strike.hit.shieldDamage > 0 && <small>護盾 −{strike.hit.shieldDamage}</small>}
      </div>}
      {playerHurt && <span className="battlefield-player-hit" aria-hidden="true">小隊受擊</span>}
    </div>

    <footer className={`battlefield-caption${bossCharge ? ' battlefield-caption--charging' : ''}`}>
      <span className="battlefield-status" role="status">{status || '消除水母，集結小隊能量'}</span>
      <span className="battlefield-next">NEXT <b>{bossCharge ? `${bossCharge.title} · ${bossCharge.effectText}` : nextAction}</b></span>
      {bossCharge && <span className="battlefield-charge-warning" role="status">⚡ 下次有效交換達成 2 波消除可打斷</span>}
      <span className="battlefield-turn">T{String(turn).padStart(2, '0')}</span>
    </footer>
  </section>;
}
