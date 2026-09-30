import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { CharacterArt, EnemyArt, JellyTile } from './components/GameArt';
import { Battlefield, idleStrike, type StrikeState } from './components/Battlefield';
import { useBoardSize } from './components/useBoardSize';
import { CHARACTERS } from './game/content/characters';
import { characterForColor } from './game/content/characters';
import { ENEMIES } from './game/content/enemies';
import { STAGES } from './game/content/stages';
import { SeededRandom } from './game/rng/SeededRandom';
import { createBattle } from './game/battle/battleFactory';
import { forceCascadeTurn, forceMatchTurn, resolveTurn } from './game/battle/turnResolver';
import { addGains, totalPower } from './game/stats/statAggregator';
import { emptyTurnStats } from './game/stats/statGenerator';
import { CHARACTER_IDS, STAT_KEYS, type BattleEvent, type BattleState, type BossChargeState, type CharacterId, type CharacterCharges, type Cell, type JellyColor, type StatKey, type TurnStats } from './game/types';
import { CHARACTER_SKILLS } from './game/content/skills';
import { emptyCharacterCharges, skillUnavailableReason, useCharacterSkill } from './game/skills/characterSkills';
import { loadProgress, loadSettings, saveSettings, saveStageClear, unlockAll, loadTeamName, saveTeamName } from './storage/progress';
import type { GameSettings } from './storage/progress';

type Screen = 'home' | 'select' | 'battle' | 'result' | 'help';
const statLabel = (stat: StatKey) => stat.toUpperCase();
const boardCopy = (board: BattleState['board']) => board.map((row) => row.map((tile) => tile ? { ...tile } : null));

function makeCue() {
  let context: AudioContext | undefined;
  return (cue: string) => {
    try {
      context ??= new AudioContext();
      const frequencies: Record<string, number> = { swap: 420, invalid: 190, pop: 620, cascade: 830, tick: 980, attack: 145, hit: 255, player: 220, win: 740, lose: 165, charge: 365, break: 740, skill: 660, heal: 520 };
      const oscillator = context.createOscillator();
      const volume = context.createGain();
      oscillator.type = cue === 'hit' || cue === 'player' ? 'triangle' : 'sine';
      oscillator.frequency.setValueAtTime(frequencies[cue] ?? 500, context.currentTime);
      if (cue === 'cascade' || cue === 'win') oscillator.frequency.exponentialRampToValueAtTime((frequencies[cue] ?? 600) * 1.35, context.currentTime + .11);
      volume.gain.setValueAtTime(.0001, context.currentTime);
      volume.gain.exponentialRampToValueAtTime(cue === 'hit' ? .045 : .025, context.currentTime + .012);
      volume.gain.exponentialRampToValueAtTime(.0001, context.currentTime + (cue === 'attack' ? .34 : .12));
      oscillator.connect(volume); volume.connect(context.destination);
      oscillator.start(); oscillator.stop(context.currentTime + .36);
    } catch { /* Audio can be unavailable in restricted browser contexts. */ }
  };
}

function actionText(battle: BattleState): string {
  const action = battle.enemy.attackPattern[battle.turns % battle.enemy.attackPattern.length]!;
  switch (action.type) {
    case 'attack': return `攻擊 ${action.amount}`;
    case 'blocker': return `障礙 +${action.amount}`;
    case 'fog': return '迷霧';
    case 'shield': return `護盾 +${action.amount}`;
    case 'darken': return '陰影';
    case 'confuse': return '問號干擾';
    case 'slime': return `黏液 +${action.amount}`;
    case 'stone': return `石化 +${action.amount}`;
  }
}

function StatsPanel({ stats, power, chainMultiplier, reeBoostPending = false, animate = false }: { stats: TurnStats; power: number; chainMultiplier: number; reeBoostPending?: boolean; animate?: boolean }) {
  return <section className="stats-panel" aria-label="本回合九項屬性">
    <div className="stats-panel__head"><span>本回合能量</span><strong className="power-number">{power}</strong>{chainMultiplier > 1 && <em className="chain-multiplier">×{chainMultiplier.toFixed(2)}</em>}{reeBoostPending && <em className="ree-boost-ready">REE 增幅 ×1.25 待命</em>}</div>
    <div className="stats-grid">
      {STAT_KEYS.map((key) => <div className="stat-chip" key={key}><span>{statLabel(key)}</span><b key={stats[key]} className={animate && stats[key] > 0 ? 'stat-gain' : ''}>{String(stats[key]).padStart(2, '0')}</b></div>)}
    </div>
  </section>;
}

function GameMark({ light = false }: { light?: boolean }) {
  return <div className={`game-mark${light ? ' game-mark--light' : ''}`}><span className="game-mark__dots"><i /><i /><i /></span><span>012S <b>PLAY LAB</b></span></div>;
}

export default function App() {
  const [hasLearnedSwap, setHasLearnedSwap] = useState(() => { try { return localStorage.getItem('jelly-swap-learned') === '1'; } catch { return false; } });
  const [screen, setScreen] = useState<Screen>('home');
  const [settings, setSettings] = useState<GameSettings>(() => loadSettings());
  const [teamName, setTeamName] = useState(loadTeamName);
  const [progress, setProgress] = useState(() => loadProgress());
  const [battle, setBattle] = useState<BattleState | null>(null);
  const [displayBoard, setDisplayBoard] = useState<BattleState['board']>([]);
  const [displayStats, setDisplayStats] = useState<TurnStats>(emptyTurnStats);
  const [displayPower, setDisplayPower] = useState(0);
  const [displayChainMultiplier, setDisplayChainMultiplier] = useState(1);
  const [displayCharges, setDisplayCharges] = useState<CharacterCharges>(() => emptyCharacterCharges());
  const [displayReeBoostPending, setDisplayReeBoostPending] = useState(false);
  const [selectedSkillCharacter, setSelectedSkillCharacter] = useState<CharacterId | null>(null);
  const [enemyHp, setEnemyHp] = useState(0);
  const [enemyShield, setEnemyShield] = useState(0);
  const [displayBossCharge, setDisplayBossCharge] = useState<BossChargeState | null>(null);
  const [playerHp, setPlayerHp] = useState(100);
  const [selected, setSelected] = useState<Cell | null>(null);
  const [matches, setMatches] = useState<Set<string>>(new Set());
  const [invalidCells, setInvalidCells] = useState<Set<string>>(new Set());
  const [activeCharacter, setActiveCharacter] = useState<CharacterId | null>(null);
  const [lastAction, setLastAction] = useState('');
  const [damageToast, setDamageToast] = useState('');
  const [busy, setBusy] = useState(false);
  const [skipAnimation, setSkipAnimation] = useState(false);
  const [hiddenPause, setHiddenPause] = useState(false);
  const [strike, setStrike] = useState<StrikeState>(idleStrike);
  const [playerHurt, setPlayerHurt] = useState(false);
  const attackFastRef = useRef(false);
  const [eventLog, setEventLog] = useState<string[]>([]);
  const [showDebug, setShowDebug] = useState(false);
  const [debugSeed, setDebugSeed] = useState('01252026');
  const [seedLabel, setSeedLabel] = useState('');

  const busyRef = useRef(false);
  const runRef = useRef(0);
  const boardRef = useRef<HTMLDivElement>(null);
  const battleShellRef = useRef<HTMLElement>(null);
  const skillDialogRef = useRef<HTMLElement>(null);
  const skillFocusReturnRef = useRef<HTMLElement | null>(null);
  const positionsRef = useRef(new Map<string, { x: number; y: number }>());
  const gestureRef = useRef<{ id: number; x: number; y: number; cell: Cell } | null>(null);
  const suppressClickRef = useRef(false);
  const [popping, setPopping] = useState(false);
  const hiddenRef = useRef(false);
  const fastRef = useRef(false);
  const soundRef = useRef(false);
  const skipRef = useRef(false);
  const rngRef = useRef<SeededRandom | null>(null);
  const displayedStageIndexRef = useRef(0);
  const pulseTimers = useRef(new Set<ReturnType<typeof setTimeout>>());
  const makeSound = useMemo(makeCue, []);
  const isDebug = useMemo(() => new URLSearchParams(window.location.search).get('debug') === '1', []);

  useBoardSize(battleShellRef, screen === 'battle');

  hiddenRef.current = hiddenPause;
  fastRef.current = settings.fast;
  soundRef.current = settings.sound;
  skipRef.current = skipAnimation;

  const play = (cue: string) => { if (soundRef.current) makeSound(cue); };

  useLayoutEffect(() => {
    const next = new Map<string, { x: number; y: number }>();
    const animations: Animation[] = [];
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    boardRef.current?.querySelectorAll<HTMLElement>('[data-tile-id]').forEach((element) => {
      const cell = element.parentElement!;
      const point = { x: cell.offsetLeft, y: cell.offsetTop };
      const previous = positionsRef.current.get(element.dataset.tileId!);
      next.set(element.dataset.tileId!, point);
      if (reduced || skipAnimation || !positionsRef.current.size) return;
      const x = previous ? previous.x - point.x : 0;
      const y = previous ? previous.y - point.y : -cell.offsetHeight;
      if (x || y) animations.push(element.animate([
        { transform: `translate(${x}px, ${y}px)`, opacity: previous ? 1 : 0 },
        { transform: 'translate(0, 0)', opacity: 1 },
      ], { duration: settings.fast ? 85 : 190, easing: 'cubic-bezier(.2,.7,.3,1)' }));
    });
    positionsRef.current = next;
    return () => animations.forEach((animation) => animation.cancel());
  }, [displayBoard, settings.fast, skipAnimation]);

  useEffect(() => {
    boardRef.current?.getAnimations({ subtree: true }).forEach((animation) => {
      if (hiddenPause) animation.pause();
      else if (animation.playState === 'paused') animation.play();
    });
  }, [hiddenPause, displayBoard]);

  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  useEffect(() => {
    const visibility = () => {
      setHiddenPause(document.visibilityState === 'hidden');
    };
    document.addEventListener('visibilitychange', visibility);
    return () => document.removeEventListener('visibilitychange', visibility);
  }, []);

  useEffect(() => {
    if (selectedSkillCharacter) skillDialogRef.current?.focus();
    else if (!busy && skillFocusReturnRef.current?.isConnected) {
      skillFocusReturnRef.current.focus();
      skillFocusReturnRef.current = null;
    }
  }, [selectedSkillCharacter, busy]);

  useEffect(() => {
    if (hiddenPause || screen !== 'battle' || battle?.status !== 'playing') setSelectedSkillCharacter(null);
  }, [hiddenPause, screen, battle?.status]);

  useEffect(() => () => {
    for (const timer of pulseTimers.current) clearTimeout(timer);
  }, []);

  const wait = (duration: number) => new Promise<void>((resolve) => {
    const run = runRef.current;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) duration = Math.min(duration, 35);
    if (skipRef.current && !hiddenRef.current) { resolve(); return; }
    let remaining = duration;
    let last = performance.now();
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      pulseTimers.current.delete(timer);
      const now = performance.now();
      if (!hiddenRef.current) remaining = skipRef.current ? 0 : remaining - (now - last);
      last = now;
      if (remaining <= 0 || run !== runRef.current) { resolve(); return; }
      timer = setTimeout(tick, hiddenRef.current ? 100 : 25);
      pulseTimers.current.add(timer);
    };
    timer = setTimeout(tick, 0);
    pulseTimers.current.add(timer);
  });

  const pushLog = (message: string) => setEventLog((log) => [...log.slice(-23), message]);
  const startStage = (stageIndex: number, forceSeed?: string) => {
    const stage = STAGES[stageIndex];
    if (!stage) return;
    cancelResolution();
    positionsRef.current.clear();
    const nextSeed = forceSeed?.trim() ? forceSeed.trim() : `${(Date.now() >>> 0).toString(16).padStart(8, '0')}`;
    const random = new SeededRandom(nextSeed);
    rngRef.current = random;
    const nextBattle = createBattle(stage, random);
    displayedStageIndexRef.current = stageIndex;
    setBattle(nextBattle);
    setDisplayBoard(boardCopy(nextBattle.board));
    setDisplayStats(emptyTurnStats());
    setDisplayPower(0);
    setDisplayChainMultiplier(1);
    setDisplayCharges(nextBattle.characterCharges);
    setDisplayReeBoostPending(false);
    setSelectedSkillCharacter(null);
    setEnemyHp(nextBattle.enemyHp);
    setEnemyShield(0);
    setDisplayBossCharge(null);
    setPlayerHp(nextBattle.playerHp);
    setSelected(null);
    setMatches(new Set());
    setInvalidCells(new Set());
    setActiveCharacter(null);
    setLastAction('');
    setDamageToast('');
    setStrike(idleStrike);
    setPlayerHurt(false);
    setEventLog([]);
    setSkipAnimation(false);
    setSeedLabel(nextSeed);
    setHiddenPause(false);
    setScreen('battle');
  };

  const animateResolution = async (events: BattleEvent[], result: BattleState, accepted: boolean) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    const run = runRef.current;
    setLastAction(''); setDamageToast('');
    if (accepted) {
      setDisplayStats(emptyTurnStats());
      setDisplayPower(0);
      setDisplayChainMultiplier(1);
      if (result.reeBoostPending) setDisplayReeBoostPending(false);
      setActiveCharacter(null);
    }
    try {
      for (const event of events) {
        if (run !== runRef.current) return;
        switch (event.type) {
          case 'SWAP':
            setDisplayBoard(event.board); setSelected(null); play('swap');
            await wait(fastRef.current ? 90 : 200); break;
          case 'INVALID_SWAP':
            setDisplayBoard(event.board); setSelected(null); setInvalidCells(new Set([`${event.a.row},${event.a.col}`, `${event.b.row},${event.b.col}`])); setLastAction('沒有連成三個，再試一次！'); play('invalid');
            await wait(fastRef.current ? 100 : 260); if (run !== runRef.current) return; setInvalidCells(new Set()); break;
          case 'MATCH_FOUND':
            setDisplayBoard(event.board); setMatches(new Set(event.cells.map((c) => `${c.row},${c.col}`)));
            await wait(fastRef.current ? 40 : 115); break;
          case 'JELLY_POP':
            setPopping(true); play(event.cascade > 1 ? 'cascade' : 'pop');
            setDamageToast(event.cascade > 1 ? `CASCADE ${event.cascade}` : 'JELLY POP!');
            await wait(fastRef.current ? 90 : 180);
            if (run !== runRef.current) return;
            setDisplayBoard(event.board); setPopping(false); setMatches(new Set()); break;
          case 'STAT_GAIN': {
            setDisplayStats((current) => addGains(current, event.gains));
            setDisplayPower((current) => current + event.gains.reduce((sum, item) => sum + item.amount, 0));
            setActiveCharacter(event.characterId);
            play('tick');
            await wait(fastRef.current ? 12 : 30); break;
          }
          case 'CHARGE_GAIN':
            setDisplayCharges((current) => ({ ...current, [event.characterId]: event.charge }));
            break;
          case 'GRAVITY':
            setDisplayBoard(event.board); await wait(fastRef.current ? 90 : 200); break;
          case 'REFILL':
            setDisplayBoard(event.board); setMatches(new Set()); await wait(fastRef.current ? 90 : 200); break;
          case 'CASCADE_START':
            setDamageToast(`連鎖 ${event.cascade} 波`); play('cascade'); await wait(fastRef.current ? 22 : 85); break;
          case 'TURN_TOTAL':
            setDisplayStats(event.stats); setDisplayPower(event.totalPower); setDisplayChainMultiplier(event.chainMultiplier); setDamageToast(`TOTAL POWER  ${event.totalPower}  ·  CHAIN ×${event.chainMultiplier.toFixed(2)}`);
            if (event.skillMultiplier > 1) setDisplayReeBoostPending(false);
            await wait(fastRef.current ? 90 : 250); break;
          case 'FINAL_ATTACK':
            attackFastRef.current = fastRef.current;
            setStrike({ phase: 'charge', fast: attackFastRef.current, attackers: event.chainWaves >= 4 ? [...CHARACTER_IDS] : CHARACTER_IDS.filter((id) => totalPower(result.characterTurnStats[id]) > 0), hit: null, chainWaves: event.chainWaves });
            setActiveCharacter(null); setLastAction(event.chainWaves >= 4 ? '全隊合擊！' : `連鎖 ×${event.chainMultiplier.toFixed(2)} · 小隊出擊！`); setDamageToast('');
            await wait(attackFastRef.current ? 50 : 120);
            if (run !== runRef.current) return;
            setStrike((current) => ({ ...current, phase: 'rush' })); play('attack');
            await wait(attackFastRef.current ? 160 : 350); break;
          case 'ENEMY_DAMAGE':
            setEnemyHp(event.enemyHp); setEnemyShield(event.enemyShield);
            setStrike((current) => ({ ...current, phase: 'impact', hit: { damage: event.damage, shieldDamage: event.shieldDamage, shieldBroken: event.shieldDamage > 0 && event.enemyShield === 0 } }));
            setLastAction(event.shieldDamage > 0 && event.enemyShield === 0 ? '護盾擊破！' : `小隊合擊 · ${event.damage} 傷害`);
            play('hit');
            await wait(attackFastRef.current ? 45 : 95);
            if (run !== runRef.current) return;
            setStrike((current) => ({ ...current, phase: 'recover' }));
            await wait(attackFastRef.current ? 190 : 430);
            if (run !== runRef.current) return;
            setStrike(idleStrike); setActiveCharacter(null); break;
          case 'ENEMY_ACTION':
            setLastAction(event.message); setDamageToast('');
            if (event.action.type === 'attack') setStrike({ ...idleStrike, phase: 'enemy', fast: fastRef.current });
            await wait(fastRef.current ? 90 : 210); break;
          case 'BOSS_CHARGE':
            setDisplayBossCharge(event.charge); setLastAction(`${event.charge.title}蓄力中`); setDamageToast('注意蓄力！連鎖 2 波可打斷'); play('charge');
            await wait(fastRef.current ? 60 : 140); break;
          case 'BOSS_BREAK':
            setDisplayBossCharge(null); setStrike({ ...idleStrike, phase: 'boss-break', fast: fastRef.current }); setLastAction('BREAK！強招已打斷'); setDamageToast('BREAK!'); play('break');
            await wait(fastRef.current ? 90 : 240); setStrike(idleStrike); break;
          case 'BOSS_SPECIAL':
            setDisplayBossCharge(null); setLastAction(`強招發動：${event.charge.title}`); setDamageToast(event.charge.title); play('attack');
            if (event.charge.actions.some((action) => action.type === 'attack')) setStrike({ ...idleStrike, phase: 'enemy', fast: fastRef.current });
            await wait(fastRef.current ? 55 : 150); break;
          case 'SKILL_USED':
            setDisplayCharges((current) => ({ ...current, [event.characterId]: event.chargeAfter })); setLastAction(`${event.characterId} 發動 ${event.skillName}`); play('skill');
            await wait(fastRef.current ? 45 : 110); break;
          case 'PLAYER_HEAL':
            setPlayerHp(event.playerHp); setLastAction(`活力補給 · HP +${event.amount}`); setDamageToast(`HP +${event.amount}`); play('heal');
            await wait(fastRef.current ? 65 : 160); break;
          case 'ENEMY_SHIELD_DAMAGE':
            setEnemyShield(event.enemyShield); setLastAction(`水波破盾 · 護盾 −${event.amount}`); setDamageToast(`SHIELD −${event.amount}`); play('break');
            await wait(fastRef.current ? 65 : 160); break;
          case 'REE_BOOST_READY':
            setDisplayReeBoostPending(true); setLastAction('烈焰增幅待命 · 下次有效交換傷害 ×1.25'); setDamageToast('DAMAGE BOOST ×1.25');
            await wait(fastRef.current ? 45 : 110); break;
          case 'PLAYER_DAMAGE':
            setDamageToast(''); setPlayerHp(event.playerHp); setPlayerHurt(true); setLastAction(`小隊受到 ${event.amount} 點攻擊`); play('player');
            setStrike(idleStrike);
            await wait(fastRef.current ? 110 : 280);
            if (run !== runRef.current) return;
            setPlayerHurt(false); break;
          case 'BOARD_EFFECT':
            setDisplayBoard(event.board); setLastAction(event.message); await wait(fastRef.current ? 38 : 120); break;
          case 'VICTORY': setLastAction('CLEAR！'); play('win'); await wait(fastRef.current ? 100 : 300); break;
          case 'DEFEAT': setLastAction('再試一次！'); play('lose'); await wait(fastRef.current ? 100 : 300); break;
        }
      }
      if (run !== runRef.current) return;
      setBattle(result);
      setDisplayBoard(boardCopy(result.board));
      setEnemyHp(result.enemyHp);
      setEnemyShield(result.enemyShield);
      setPlayerHp(result.playerHp);
      setDisplayBossCharge(result.bossCharge);
      setDisplayStats(result.turnStats);
      setDisplayPower(result.totalPower);
      setDisplayChainMultiplier(result.chainMultiplier);
      setDisplayCharges(result.characterCharges);
      setDisplayReeBoostPending(result.reeBoostPending);
      if (result.status === 'victory') {
        const saved = saveStageClear(displayedStageIndexRef.current);
        setProgress(saved);
        await wait(fastRef.current ? 100 : 300);
        if (run === runRef.current) setScreen('result');
      } else if (result.status === 'defeat') {
        await wait(fastRef.current ? 100 : 300);
        if (run === runRef.current) setScreen('result');
      }
    } finally {
      if (run === runRef.current) {
        busyRef.current = false;
        setBusy(false);
        setSkipAnimation(false);
      }
    }
  };

  const cancelResolution = () => {
    runRef.current += 1;
    busyRef.current = false;
    gestureRef.current = null;
    setBusy(false); setHiddenPause(false); setPopping(false);
    setSelected(null); setMatches(new Set()); setInvalidCells(new Set());
    setSelectedSkillCharacter(null);
    setStrike(idleStrike); setPlayerHurt(false); setDamageToast('');
  };

  const leaveBattle = () => { cancelResolution(); setScreen('select'); };

  const attemptSwap = (a: Cell, b: Cell) => {
    if (!battle || busyRef.current || hiddenPause || battle.status !== 'playing') return;
    const result = resolveTurn(battle, a, b, rngRef.current ?? new SeededRandom(seedLabel));
    if (result.accepted) { setHasLearnedSwap(true); try { localStorage.setItem('jelly-swap-learned', '1'); } catch { /* Storage may be unavailable. */ } }
    if (result.accepted) pushLog(`TURN ${battle.turns + 1}｜${result.events.filter((event) => event.type === 'JELLY_POP').length} 次消除段`);
    void animateResolution(result.events, result.battle, result.accepted);
  };

  const selectTile = (cell: Cell) => {
    if (busyRef.current || hiddenPause || !battle) return;
    if (!selected) { setSelected(cell); return; }
    if (selected.row === cell.row && selected.col === cell.col) { setSelected(null); return; }
    if (Math.abs(selected.row - cell.row) + Math.abs(selected.col - cell.col) === 1) {
      attemptSwap(selected, cell);
      setSelected(null);
    } else setSelected(cell);
  };

  const handleCellKey = (event: KeyboardEvent<HTMLButtonElement>, cell: Cell) => {
    if (event.key === 'Escape') { setSelected(null); return; }
    const directions: Record<string, Cell> = { ArrowUp: { row: -1, col: 0 }, ArrowDown: { row: 1, col: 0 }, ArrowLeft: { row: 0, col: -1 }, ArrowRight: { row: 0, col: 1 } };
    const delta = directions[event.key];
    if (delta) {
      event.preventDefault();
      if (event.shiftKey) { attemptSwap(cell, { row: cell.row + delta.row, col: cell.col + delta.col }); return; }
      const row = Math.max(0, Math.min(5, cell.row + delta.row));
      const col = Math.max(0, Math.min(5, cell.col + delta.col));
      document.getElementById(`cell-${row}-${col}`)?.focus();
    }
  };

  const updateSettings = (change: Partial<GameSettings>) => setSettings((value) => ({ ...value, ...change }));

  const openSkillPanel = (characterId: CharacterId) => {
    if (!battle || busyRef.current || hiddenPause || battle.status !== 'playing') return;
    skillFocusReturnRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setSelectedSkillCharacter(characterId);
  };

  const closeSkillPanel = () => setSelectedSkillCharacter(null);

  const castSelectedSkill = () => {
    if (!battle || !selectedSkillCharacter || busyRef.current || hiddenPause || battle.status !== 'playing') return;
    const reason = skillUnavailableReason(battle, selectedSkillCharacter);
    if (reason) return;
    const result = useCharacterSkill(battle, selectedSkillCharacter);
    if (!result.accepted) return;
    pushLog(`SKILL ${selectedSkillCharacter} ${CHARACTER_SKILLS[selectedSkillCharacter].name}`);
    setSelectedSkillCharacter(null);
    void animateResolution(result.events, result.battle, false);
  };

  const handleSkillDialogKey = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeSkillPanel();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled)'));
    if (!focusable.length) return;
    const first = focusable[0]!;
    const last = focusable[focusable.length - 1]!;
    if (event.shiftKey && (document.activeElement === first || document.activeElement === event.currentTarget)) {
      event.preventDefault(); last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault(); first.focus();
    }
  };

  const activeSkill = selectedSkillCharacter ? CHARACTER_SKILLS[selectedSkillCharacter] : null;
  const skillBlockReason = selectedSkillCharacter && battle ? skillUnavailableReason(battle, selectedSkillCharacter) : null;
  const skillCanBeCast = Boolean(selectedSkillCharacter && battle && !skillBlockReason && !busy && !hiddenPause && battle.status === 'playing');

  const debugResolution = (color: JellyColor) => {
    if (!battle || busyRef.current || !rngRef.current) return;
    const result = forceMatchTurn(battle, color, rngRef.current);
    if (result.accepted) { pushLog(`DEBUG FORCE ${color.toUpperCase()}`); void animateResolution(result.events, result.battle, true); }
  };

  const debugCascade = () => {
    if (!battle || busyRef.current || !rngRef.current) return;
    const result = forceCascadeTurn(battle, rngRef.current);
    if (result.accepted) { pushLog('DEBUG FORCE CASCADE'); void animateResolution(result.events, result.battle, true); }
  };

  const debugWin = () => {
    if (!battle) return;
    const won = { ...battle, enemyHp: 0, status: 'victory' as const };
    setBattle(won); setEnemyHp(0); pushLog('DEBUG WIN'); setScreen('result');
    setProgress(saveStageClear(displayedStageIndexRef.current));
  };

  const debugNudge = (kind: 'enemy' | 'player') => {
    if (!battle) return;
    if (kind === 'enemy') {
      const hp = Math.max(1, battle.enemyHp - 50);
      setBattle({ ...battle, enemyHp: hp }); setEnemyHp(hp);
    } else {
      const hp = Math.max(0, battle.playerHp - 20);
      setBattle({ ...battle, playerHp: hp, status: hp ? battle.status : 'defeat' }); setPlayerHp(hp);
      if (!hp) setScreen('result');
    }
  };

  return <div className="app-shell">
    {screen !== 'battle' && screen !== 'result' && <header className="site-header"><button className="brand-button" onClick={() => setScreen('home')} aria-label="返回首頁"><GameMark /></button><div className="site-actions"><button className="quiet-button" onClick={() => setScreen('help')}><span aria-hidden="true">ⓘ</span> 玩法說明</button><button className={`sound-toggle${settings.sound ? ' is-on' : ''}`} onClick={() => updateSettings({ sound: !settings.sound })} aria-label={settings.sound ? '關閉音效' : '開啟音效'}>{settings.sound ? '♫ 音效 ON' : '♫ 音效 OFF'}</button></div></header>}

    {screen === 'home' && <main className="home-screen">
      <section className="home-hero">
        <div className="home-hero__copy">
          <div className="eyebrow"><span>012S ORIGINAL GAME</span><span className="eyebrow-dot" /></div>
          <h1>JELLY<br /><span>BOSS MATCH</span></h1>
          <p className="home-tagline">集結水母能量，<br className="mobile-break" />挑戰異常怪獸。</p>
          <p className="home-desc">交換水母、串起連鎖，讓五位夥伴把每一點能量都變成漂亮的反擊。</p>
          <div className="home-buttons"><button className="primary-button" onClick={() => setScreen('select')}>開始冒險 <span aria-hidden="true">↗</span></button><button className="secondary-button" onClick={() => setScreen('help')}>看看玩法 <span aria-hidden="true">→</span></button></div>
          <div className="chapter-progress"><div className="chapter-progress__mark">✦</div><div><b>CHAPTER 01</b><span>已解鎖 {Math.max(1, progress.maxUnlockedIndex + 1)} / {STAGES.length} 個關卡</span></div><button onClick={() => setScreen('select')} aria-label="選擇關卡">↗</button></div>
        </div>
        <div className="home-hero__art" aria-label="五位膠囊夥伴">
          <div className="hero-orbit hero-orbit--one" /><div className="hero-orbit hero-orbit--two" /><span className="hero-star hero-star--a">✦</span><span className="hero-star hero-star--b">✧</span><div className="hero-spark hero-spark--a"/><div className="hero-spark hero-spark--b"/>
          <div className="hero-boss-peek"><EnemyArt kind="blur" /><span>今天也有新對手！</span></div>
          <div className="hero-characters">{CHARACTER_IDS.map((id, index) => <div className={`hero-character hero-character--${index}`} key={id}><CharacterArt id={id} /><span>{id}</span></div>)}</div>
          <div className="floating-jelly floating-jelly--one"><JellyTile color="purple" selected={false}/></div><div className="floating-jelly floating-jelly--two"><JellyTile color="green" selected={false}/></div>
          <div className="hero-art-sticker">READY<br /><b>TO POP!</b></div>
        </div>
      </section>
      <section className="home-strip"><span>5 位特色夥伴</span><i /><span>9 項能量數值</span><i /><span>每一場都是新連鎖</span><button onClick={() => setScreen('select')}>選擇關卡 <span>↗</span></button></section>
      <footer className="site-footer"><GameMark /><span>一場輕快的消除冒險，隨時可以開始。</span><span>© 012S PLAY LAB</span></footer>
    </main>}

    {screen === 'select' && <main className="selection-screen">
      <div className="section-heading"><div><span className="eyebrow">STAGE SELECT · 冒險地圖</span><h1>選一個關卡，<br className="mobile-break"/>開始出發。</h1></div><button className="back-button" onClick={() => setScreen('home')}>← 返回首頁</button></div>
      <div className="stage-chapters">{([1, 2] as const).map((chapter) => {
        const chapterStages = STAGES.map((stage, index) => ({ stage, index })).filter(({ stage }) => stage.chapter === chapter);
        const clearCount = chapterStages.filter(({ stage }) => progress.clearedIds.includes(stage.id)).length;
        return <section className="stage-chapter" key={chapter}>
          <div className="chapter-heading"><span>{String(chapter).padStart(2,'0')}</span><div><b>CHAPTER {String(chapter).padStart(2,'0')}</b><strong>{chapter === 1 ? '水母小隊集合！' : '全新的怪獸挑戰'}</strong></div><small>{clearCount} / {chapterStages.length} CLEAR</small></div>
          <div className="stage-grid">
        {chapterStages.map(({ stage, index }) => {
          const enemy = ENEMIES[stage.enemyId]!;
          const unlocked = index <= progress.maxUnlockedIndex;
          const cleared = progress.clearedIds.includes(stage.id);
          return <button className={`stage-card${unlocked ? '' : ' stage-card--locked'}${cleared ? ' stage-card--clear' : ''}`} key={stage.id} disabled={!unlocked} onClick={() => startStage(index)}>
            <span className="stage-card__index">{stage.id} {cleared ? <b>✓ CLEAR</b> : unlocked ? <i>進入 ↗</i> : <i>🔒</i>}</span>
            <span className="stage-card__art"><EnemyArt kind={enemy.kind}/><span className={`enemy-kind enemy-kind--${enemy.kind}`}>{enemy.type === 'boss' ? 'BOSS' : 'STAGE'}</span></span>
            <span className="stage-card__title">{stage.title}</span><span className="stage-card__enemy">{enemy.name} <i>·</i> {enemy.type === 'boss' ? '大型挑戰' : '關卡'}</span>
            <span className="stage-card__difficulty" aria-label={`難度 ${stage.difficulty}`}>{Array.from({ length: 3 }, (_, i) => <i key={i} className={i < stage.difficulty ? 'active' : ''}/>)}</span>
          </button>;
        })}
          </div>
        </section>;
      })}</div>
      <div className="selection-note"><span>✦</span>關卡進度會保存在這台裝置，擊敗對手就能前往下一站。</div>
    </main>}

    {screen === 'help' && <main className="help-screen"><button className="back-button" onClick={() => setScreen('home')}>← 返回首頁</button><div className="help-intro"><span className="eyebrow">HOW TO PLAY · 玩法說明</span><h1>交換一下，<br className="mobile-break"/>連鎖就出發。</h1><p>每一顆水母都有自己的角色與能量。鍵盤可用方向鍵移動、Shift＋方向鍵交換，Esc 取消選取。</p></div><div className="help-layout"><div className="help-board-mini">{['green','purple','red','cyan','yellow','purple','red','cyan','yellow','green','cyan','yellow','green','purple','red','yellow','green','purple','red','cyan','purple','red','cyan','yellow','green'].map((color,i)=><span key={i}><JellyTile color={color as JellyColor} selected={i===7}/></span>)}</div><ol className="help-list"><li><b>交換相鄰水母</b><span>滑動水母，或點選兩顆相鄰水母。連成三個以上就會消除。</span></li><li><b>每顆都會累積能量</b><span>水母顏色對應一位夥伴；消除的每一顆都會各自產生數值。</span></li><li><b>三項主屬性必定增加</b><span>每顆水母都會讓角色的三項主屬性各增加 +1～3。</span></li><li><b>其他能力隨機追加</b><span>每顆水母可能再帶來 0～2 項額外數值。</span></li><li><b>連鎖越多，能量越高</b><span>水母落下後再次連線，會繼續累積更多數值。</span></li><li><b>能量集中，漂亮反擊</b><span>回合結束時，所有能量會化為一次攻擊。擊敗對手即可過關！</span></li></ol></div><div className="help-callout"><b>本回合能量</b>{STAT_KEYS.slice(0, 5).map((key) => <span key={key}>{key} <i>+2</i></span>)}<strong>→ 集中攻擊 →</strong></div></main>}

    {screen === 'battle' && battle && <main ref={battleShellRef} className="battle-shell">
      <header className="battle-topbar"><button className="battle-exit" onClick={leaveBattle} aria-label="返回選關">← <span>關卡</span></button><div className="battle-stage-id"><strong className="battle-stage-title">{battle.stage.title}</strong><span>{battle.stage.id} · 第 {battle.turns} 回合</span></div><div className="battle-quick-settings"><button className="tool-button" aria-label="快速模式" aria-pressed={settings.fast} onClick={() => updateSettings({ fast: !settings.fast })}>»</button><button className="tool-button" aria-label="音效" aria-pressed={settings.sound} onClick={() => updateSettings({ sound: !settings.sound })}>♪</button></div></header>

      <Battlefield enemy={battle.enemy} hp={enemyHp} playerHp={playerHp} shield={enemyShield}
        teamName={teamName} onTeamNameChange={(name) => setTeamName(saveTeamName(name))} nextAction={actionText(battle)} bossCharge={displayBossCharge} status={lastAction} cue={damageToast}
        activeCharacter={activeCharacter} charges={displayCharges} skillsDisabled={busy || hiddenPause || battle.status !== 'playing'} onSkillSelect={openSkillPanel} strike={strike} playerHurt={playerHurt}
        paused={hiddenPause} skipping={skipAnimation} presenting={busy} />

      <StatsPanel stats={displayStats} power={displayPower} chainMultiplier={displayChainMultiplier} reeBoostPending={displayReeBoostPending} animate={Boolean(busy)} />

      {selectedSkillCharacter && battle && activeSkill && <div className="skill-overlay" onPointerDown={(event) => { if (event.target === event.currentTarget) closeSkillPanel(); }}>
        <section ref={skillDialogRef} className={`skill-dialog skill-dialog--${CHARACTERS[selectedSkillCharacter].color}`} role="dialog" aria-modal="true" aria-labelledby="skill-dialog-title" tabIndex={-1} onKeyDown={handleSkillDialogKey}>
          <button className="skill-dialog__close" onClick={closeSkillPanel} aria-label="關閉技能說明">×</button>
          <div className="skill-dialog__identity"><CharacterArt id={selectedSkillCharacter}/><span>{selectedSkillCharacter} · 技能</span></div>
          <h2 id="skill-dialog-title">{activeSkill.name} <i aria-hidden="true">{activeSkill.icon}</i></h2>
          <p>{activeSkill.effectText}</p>
          <div className="skill-charge-copy"><span>技能充能</span><b>{displayCharges[selectedSkillCharacter]} / {activeSkill.chargeCost}</b></div>
          <div className="skill-charge-track" role="progressbar" aria-label={`${selectedSkillCharacter} 技能充能`} aria-valuemin={0} aria-valuemax={activeSkill.chargeCost} aria-valuenow={Math.min(activeSkill.chargeCost, displayCharges[selectedSkillCharacter])}><span style={{ width: `${Math.min(100, displayCharges[selectedSkillCharacter] / activeSkill.chargeCost * 100)}%` }}/></div>
          <div className={`skill-dialog__status${skillBlockReason ? ' skill-dialog__status--blocked' : ''}`} role="status">{skillBlockReason ? `目前無法施放：${skillBlockReason}` : '可以施放 · 不消耗交換回合'}</div>
          <div className="skill-dialog__actions"><button className="skill-cast-button" onClick={castSelectedSkill} disabled={!skillCanBeCast}>施放技能 <span>✦</span></button><button className="skill-close-button" onClick={closeSkillPanel}>關閉</button></div>
        </section>
      </div>}

      <section className={`board-section${battle.darkTurns > 0 ? ' board-section--dim' : ''}${busy ? ' board-section--busy' : ''}`} aria-label="6 乘 6 水母盤面">
        {(!hasLearnedSwap || selected) && <div className="board-instruction" role="status">{selected ? '再選一顆相鄰水母' : '滑動或點選兩格，連成 3 個以上'}</div>}
        <div ref={boardRef} className={`match-board${popping ? ' match-board--popping' : ''}${settings.fast ? ' match-board--fast' : ''}`} role="group" aria-label="水母消除盤面：滑動或點選兩格交換；方向鍵移動，Shift 加方向鍵交換，Escape 取消選取" aria-busy={busy}>
          {displayBoard.flatMap((row, rowIndex) => row.map((tile, colIndex) => {
            const cell = { row: rowIndex, col: colIndex };
            const sel = selected?.row === rowIndex && selected.col === colIndex;
            const activeMatch = matches.has(`${rowIndex},${colIndex}`);
            const character = tile ? characterForColor(tile.color) : null;
            const label = tile ? `${character?.id} ${tile.color} 水母，第 ${rowIndex+1} 列第 ${colIndex+1} 欄${tile.lockHits ? '，被障礙鎖住' : ''}${tile.fog ? '，迷霧覆蓋但顏色可辨識' : ''}${tile.confused ? '，有問號標記' : ''}` : `空格，第 ${rowIndex+1} 列第 ${colIndex+1} 欄`;
            return <button id={`cell-${rowIndex}-${colIndex}`} key={`${rowIndex}-${colIndex}`} type="button" className={`board-cell${sel ? ' board-cell--selected' : ''}${activeMatch ? ' board-cell--match' : ''}${invalidCells.has(`${rowIndex},${colIndex}`) ? ' board-cell--invalid' : ''}${tile?.lockHits ? ' board-cell--locked' : ''}`} aria-label={label} aria-pressed={sel} disabled={busy || hiddenPause || !tile || Boolean(tile.lockHits) || battle.status !== 'playing'} onPointerDown={(event) => {
                if (event.button !== 0 || !event.isPrimary || busyRef.current) return;
                suppressClickRef.current = false;
                gestureRef.current = { id: event.pointerId, x: event.clientX, y: event.clientY, cell };
                event.currentTarget.setPointerCapture(event.pointerId);
              }} onPointerUp={(event) => {
                const gesture = gestureRef.current;
                gestureRef.current = null;
                if (!gesture || gesture.id !== event.pointerId) return;
                const dx = event.clientX - gesture.x;
                const dy = event.clientY - gesture.y;
                const threshold = Math.max(12, event.currentTarget.clientWidth * .22);
                if (Math.max(Math.abs(dx), Math.abs(dy)) < threshold) return;
                suppressClickRef.current = true;
                const target = Math.abs(dx) > Math.abs(dy)
                  ? { row: gesture.cell.row, col: gesture.cell.col + Math.sign(dx) }
                  : { row: gesture.cell.row + Math.sign(dy), col: gesture.cell.col };
                if (!displayBoard[target.row]?.[target.col] || displayBoard[target.row]?.[target.col]?.lockHits) return;
                attemptSwap(gesture.cell, target);
              }} onPointerCancel={() => { gestureRef.current = null; }} onLostPointerCapture={() => { gestureRef.current = null; }}
              onClick={(event) => {
                if (event.detail > 0 && suppressClickRef.current) { suppressClickRef.current = false; return; }
                selectTile(cell);
              }} onKeyDown={(e) => handleCellKey(e, cell)} data-testid={`cell-${rowIndex}-${colIndex}`}>
              {tile && <span className="tile-motion" data-tile-id={tile.id}><JellyTile color={tile.color} selected={sel || activeMatch} fog={tile.fog} lockHits={tile.lockHits} confused={tile.confused} dimmed={battle.darkTurns > 0}/></span>}
            </button>;
          }))}
        </div>

      </section>

      <footer className="battle-footer"><div className="battle-footer-actions">{busy && <button className="skip-button" onClick={() => setSkipAnimation(true)} disabled={skipAnimation || hiddenPause} aria-label="略過目前動畫">{skipAnimation ? '結算中…' : '略過動畫 ›'}</button>}{isDebug && !busy && <span className="seed-note">SEED {seedLabel.toUpperCase()}</span>}{isDebug && <button className="debug-toggle" onClick={() => setShowDebug((v) => !v)}>DEBUG</button>}</div></footer>

      {isDebug && showDebug && <section className="debug-panel"><div className="debug-panel__head"><b>DEBUG PANEL</b><span>SEED {seedLabel}</span><button onClick={() => setShowDebug(false)}>收起 ×</button></div><div className="debug-seed"><input value={debugSeed} onChange={(e) => setDebugSeed(e.target.value)} aria-label="輸入 RNG Seed"/><button onClick={() => startStage(displayedStageIndexRef.current, debugSeed)}>套用 Seed</button><button onClick={() => pushLog(`RNG seed ${seedLabel}`)}>顯示 Seed</button></div><div className="debug-actions"><button onClick={debugWin}>Win Stage</button><button onClick={() => debugNudge('enemy')}>Boss HP −50</button><button onClick={() => debugNudge('player')}>Player HP −20</button><button onClick={() => startStage(displayedStageIndexRef.current, seedLabel)}>Reset Stage</button><button onClick={() => { setProgress(unlockAll()); }}>Unlock All Stages</button><button onClick={debugCascade}>Force Cascade Board</button>{CHARACTER_IDS.map((id) => <button key={id} onClick={() => debugResolution(CHARACTERS[id].color)}>Force {id} Match</button>)}</div><div className="debug-log"><b>Last Turn Stats · {totalPower(battle.turnStats)} TOTAL</b>{STAT_KEYS.map((s) => <span key={s}>{s} {battle.turnStats[s]}</span>)}<details><summary>Event Log（最近 24 則）</summary>{eventLog.slice(-24).map((entry,i)=><p key={`${i}-${entry}`}>{entry}</p>)}</details></div></section>}

    </main>}

    {screen === 'result' && battle && <main className={`result-screen result-screen--${battle.status}`}>
      <header className="result-top"><GameMark /><button className="quiet-button" onClick={() => setScreen('select')}>關卡選單 ↗</button></header>
      <div className="result-hero"><div className="result-art"><span className="result-orbit"/>{battle.status === 'victory' ? <div className="result-party">{CHARACTER_IDS.map((id) => <CharacterArt id={id} key={id}/>)}</div> : <EnemyArt kind={battle.enemy.kind}/>}<span className="result-star">✦</span></div><div className="result-copy"><span className={`result-kicker${battle.status === 'defeat' ? ' result-kicker--defeat' : ''}`}>{battle.status === 'victory' ? 'STAGE CLEAR · MISSION COMPLETE' : 'ONE MORE TRY · REGROUP'}</span><h1>{battle.status === 'victory' ? 'CLEAR！' : '再接再厲！'}</h1><p>{battle.status === 'victory' ? '這回合的能量，化成漂亮的一擊。' : '調整交換順序、善用下一招提示，再試一次。'}</p></div></div>
      <div className="result-content"><section className="result-score"><div><span>出戰回合</span><b>{battle.turns}</b></div><div><span>累積傷害</span><b>{battle.totalDamage}</b></div><div><span>最高單回合</span><b>{battle.highestTurnDamage}</b></div><div><span>最高連鎖</span><b>×{battle.highestCascade}</b></div><div className="result-total"><span>本關累積能量</span><b>{totalPower(battle.stageStats)} <small>POWER</small></b></div></section>
        <section className="result-stats"><div className="result-section-heading"><div><span>STAGE TOTAL</span><b>本關九項能量</b></div><span>每一顆都有累積</span></div><div className="result-stat-grid">{STAT_KEYS.map((stat) => <div className="result-stat" key={stat}><span>{stat}</span><b>{battle.stageStats[stat]}</b></div>)}</div></section>
      </div>
      <div className="result-actions"><button className="primary-button" onClick={() => { const nextIndex = displayedStageIndexRef.current + 1; if (battle.status === 'victory' && nextIndex <= progress.maxUnlockedIndex) startStage(nextIndex); else setScreen('select'); }}>{battle.status === 'victory' && displayedStageIndexRef.current + 1 < STAGES.length && progress.maxUnlockedIndex > displayedStageIndexRef.current ? '前往下一關' : '選擇關卡'} <span>→</span></button><button className="secondary-button" onClick={() => startStage(displayedStageIndexRef.current)}>再挑戰一次 <span>↻</span></button><span>{battle.status === 'victory' ? '已儲存冒險進度' : '還有很多能量等著集結'}</span></div>
    </main>}
  </div>;
}
