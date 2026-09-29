import { useLayoutEffect, useRef, type CSSProperties } from 'react';
import { CHARACTERS } from '../game/content/characters';
import { CHARACTER_IDS, type CharacterId, type EnemyConfig } from '../game/types';
import { CharacterArt, EnemyArt } from './GameArt';
import './Battlefield.css';

export type StrikeState = {
  phase: 'idle' | 'charge' | 'rush' | 'impact' | 'recover' | 'enemy';
  fast: boolean;
  attackers: CharacterId[];
  hit: { damage: number; shieldDamage: number; shieldBroken: boolean } | null;
};

export const idleStrike: StrikeState = { phase: 'idle', fast: false, attackers: [], hit: null };

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
  turn: number;
  status: string;
  cue: string;
  activeCharacter: CharacterId | null;
  strike: StrikeState;
  playerHurt: boolean;
  paused: boolean;
  skipping: boolean;
};

export function Battlefield({ enemy, hp, shield, nextAction, turn, status, cue, activeCharacter, strike, playerHurt, paused, skipping }: Props) {
  const fieldRef = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    fieldRef.current?.getAnimations({ subtree: true }).forEach((animation) => {
      if (paused) animation.pause();
      else if (animation.playState === 'paused') animation.play();
    });
  }, [paused, strike.phase]);
  const percent = Math.max(0, Math.min(100, hp / enemy.maxHp * 100));
  const hitting = strike.phase === 'impact' || strike.phase === 'recover';
  return <section ref={fieldRef} className={`battlefield battlefield--${strike.phase}${strike.fast ? ' battlefield--fast' : ''}${playerHurt ? ' battlefield--player-hit' : ''}${paused ? ' battlefield--paused' : ''}${skipping ? ' battlefield--skip' : ''}`} aria-label="小隊戰場">
    <header className="battlefield-hud">
      <div className="battlefield-title"><span>{enemy.type === 'boss' ? 'BOSS BATTLE' : 'JELLY SQUAD'}</span><h1>{enemy.name}</h1></div>
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
      </div>

      {CHARACTER_IDS.map((id, index) => {
        const slot = formation[index]!;
        const attacking = strike.attackers.includes(id);
        const style = {
          '--home-x': `${slot.x}%`, '--home-y': `${slot.y}%`,
          '--target-x': `${slot.targetX}%`, '--target-y': `${slot.targetY}%`,
          '--accent': CHARACTERS[id].accent, '--idle-delay': `${index * -.37}s`,
          zIndex: 3 + index,
        } as CSSProperties;
        return <div key={id} style={style} className={`battlefield-hero${attacking ? ' battlefield-hero--attacking' : ''}${activeCharacter === id ? ' battlefield-hero--energized' : ''}`}>
          <span className="battlefield-hero-shadow" aria-hidden="true" />
          <span className="battlefield-trail" aria-hidden="true" />
          <div className="battlefield-hero-art"><CharacterArt id={id} /></div>
          <span className="battlefield-hero-name">{id}</span>
        </div>;
      })}

      {strike.hit && <div className="battlefield-impact" aria-hidden="true"><i /><i /><i /><i /><b>✦</b></div>}
      {strike.hit && <div className="battlefield-damage" role="status">
        <span>{strike.hit.shieldBroken ? '破盾！' : 'HIT!'}</span>
        <strong>{strike.hit.damage}</strong>
        {strike.hit.shieldDamage > 0 && <small>護盾 −{strike.hit.shieldDamage}</small>}
      </div>}
      {playerHurt && <span className="battlefield-player-hit" aria-hidden="true">小隊受擊</span>}
    </div>

    <footer className="battlefield-caption">
      <span className="battlefield-status" role="status">{status || '消除水母，集結小隊能量'}</span>
      <span className="battlefield-next">NEXT <b>{nextAction}</b></span>
      <span className="battlefield-turn">T{String(turn).padStart(2, '0')}</span>
    </footer>
  </section>;
}
