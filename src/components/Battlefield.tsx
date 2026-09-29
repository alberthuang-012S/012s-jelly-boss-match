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
  { x: 34, y: 64, targetX: 65, targetY: 46 },
  { x: 8, y: 29, targetX: 59, targetY: 29 },
  { x: 8, y: 64, targetX: 60, targetY: 60 },
  { x: 25, y: 29, targetX: 68, targetY: 19 },
  { x: 21, y: 64, targetX: 68, targetY: 72 },
];

type Props = {
  enemy: EnemyConfig;
  hp: number;
  shield: number;
  nextAction: string;
  bossCharge: BossChargeState | null;
  stageTitle: string;
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
  presenting: boolean;
};

export function Battlefield({ enemy, hp, shield, nextAction, bossCharge, stageTitle, status, cue, activeCharacter, charges, skillsDisabled, onSkillSelect, strike, playerHurt, paused, skipping, presenting }: Props) {
  const fieldRef = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    fieldRef.current?.getAnimations({ subtree: true }).forEach((animation) => {
      if (paused) animation.pause();
      else if (animation.playState === 'paused') animation.play();
    });
  }, [paused, strike.phase]);
  const percent = Math.max(0, Math.min(100, hp / enemy.maxHp * 100));
  const hitting = strike.phase === 'impact' || strike.phase === 'recover';
  const strongHit = strike.chainWaves >= 3 || Boolean(strike.hit?.shieldBroken);
  // One transient message, in priority order; the boss warning remains persistent.
  const notice = !presenting || skipping || strike.hit ? ''
    : strike.phase === 'boss-break' ? '強招打斷！'
    : playerHurt ? status
    : /^HP \+/.test(cue) ? `回復 ${cue}`
    : /^SHIELD /.test(cue) ? cue.replace('SHIELD', '護盾')
    : cue.startsWith('DAMAGE BOOST') ? '烈焰增幅已就緒'
    : status.includes('發動') || status.startsWith('強招發動') ? status
    : cue.startsWith('CASCADE ') ? `連鎖 ${cue.slice(8)} 波`
    : cue.startsWith('連鎖 ') ? cue : '';
  return <section ref={fieldRef} className={`battlefield battlefield--${strike.phase} battlefield--chain-${strike.chainWaves}${hitting ? ' battlefield--hit' : ''}${strongHit ? ' battlefield--strong' : ''}${bossCharge ? ' battlefield--charging' : ''}${strike.fast ? ' battlefield--fast' : ''}${playerHurt ? ' battlefield--player-hit' : ''}${paused ? ' battlefield--paused' : ''}${skipping ? ' battlefield--skip' : ''}`} aria-label="小隊戰場">
    <header className="battlefield-hud">
      <div className="battlefield-title"><span>{stageTitle}</span></div>
      <div className="battlefield-vitals"><h1 className="battlefield-name">{enemy.name}</h1>
        <div className="battlefield-hp-label"><span>敵人 HP</span><b>{hp}<small> / {enemy.maxHp}</small></b></div>
        <div className="battlefield-hp" role="progressbar" aria-label="敵人 HP" aria-valuemin={0} aria-valuemax={enemy.maxHp} aria-valuenow={hp}>
          <span className="battlefield-hp-trail" style={{ width: `${percent}%` }} />
          <span className="battlefield-hp-fill" style={{ width: `${percent}%` }} />
        </div>
        <span className="battlefield-shield">{shield > 0 ? `✧ 護盾 ${shield}` : ' '}</span>
      </div>
    </header>

    <div className="battlefield-scene">

      <div className="battlefield-floor" aria-hidden="true" />

      <div className="battlefield-enemy">
        <div className="battlefield-enemy-shadow" />
        <EnemyArt kind={enemy.kind} />

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

      {strike.hit && !skipping && <div className="battlefield-impact" aria-hidden="true"><i /><i />{strongHit && <><i /><i /></>}<b>✦</b></div>}
      {strike.hit && !skipping ? <div className="battlefield-damage" role="status" aria-label={`造成 ${strike.hit.damage} 傷害${strike.hit.shieldBroken ? '，護盾擊破' : ''}`}>
        {(strike.hit.shieldBroken || strongHit) && <span>{strike.hit.shieldBroken ? '破盾！' : '連鎖合擊'}</span>}
        <strong>{strike.hit.damage}</strong>
        {strike.hit.shieldDamage > 0 && <small>護盾 −{strike.hit.shieldDamage}</small>}
      </div> : notice ? <span key={notice} className={`battlefield-notice${playerHurt ? ' battlefield-notice--hurt' : ''}`} role="status">{notice}</span> : null}
    </div>

    <span className="sr-only">下一招：{nextAction}</span>
    {bossCharge && <div className="battlefield-charge-notice" role="status"><b>⚡ {bossCharge.title} · {bossCharge.effectText}</b><span>下次有效交換達成 2 波消除可打斷</span></div>}

  </section>;
}
