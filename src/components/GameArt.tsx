import type { CharacterId, JellyColor } from '../game/types';
import { CHARACTERS } from '../game/content/characters';
import { DiseaseEnemyArt } from './DiseaseEnemyArt';

export function CharacterArt({ id, className = '' }: { id: CharacterId; className?: string }) {
  const accent = CHARACTERS[id].accent;
  const darker = id === 'COO' ? '#967719' : id === 'KTT' ? '#287e91' : accent;
  const isWarm = id === 'REE' || id === 'KTT';
  return (
    <svg className={`character-art character-art--${id.toLowerCase()} ${className}`} viewBox="0 0 128 144" role="img" aria-label={`${id} 膠囊夥伴`}>
      <defs>
        <linearGradient id={`body-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#fff" /><stop offset=".58" stopColor="#fffdf7" /><stop offset="1" stopColor={id === 'COO' ? '#fff0aa' : `${accent}`} />
        </linearGradient>
        <linearGradient id={`shell-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor={`${accent}`} /><stop offset="1" stopColor={`${darker}`} />
        </linearGradient>
        <filter id={`shadow-${id}`} x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="3" stdDeviation="3" floodColor="#26385b" floodOpacity=".16" /></filter>
      </defs>
      {id === 'QCC' && <path d="M27 66 Q4 89 23 111 Q28 91 43 91" fill={`${accent}`} opacity=".95" />}
      {id === 'REE' && <path d="M39 31 Q30 17 44 9 Q44 20 55 14 Q54 27 64 27 Q55 35 39 31Z" fill="#ff9a48" stroke="#d64e50" strokeWidth="3" />}
      {id === 'KTT' && <path d="M34 36 L38 17 L50 26 L63 12 L73 27 L88 18 L93 38Z" fill={`${accent}`} stroke="#ad702f" strokeWidth="3" strokeLinejoin="round" />}
      {id === 'PNN' && <g transform="translate(61 21) rotate(-15)"><path d="M0 12 Q-20 -4 -17 -15 Q-2 -15 2 4 Q8 -14 20 -10 Q20 5 4 14Z" fill="#78be43" stroke="#488a32" strokeWidth="2.5" /><path d="M2 15v8" stroke="#488a32" strokeWidth="3" strokeLinecap="round" /></g>}
      {id === 'COO' && <g fill="none" stroke="#a58528" strokeWidth="4"><ellipse cx="64" cy="33" rx="30" ry="8" transform="rotate(-9 64 33)"/><path d="M40 33v8m48-16-1 8" strokeLinecap="round"/></g>}
      {/* Little arms and boots give the pill mascot a toy-like stance. */}
      <g filter={`url(#shadow-${id})`} stroke={id === 'COO' ? '#9c812b' : `${darker}`} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M34 84 Q15 83 15 98 Q17 106 31 101 L40 95" fill={`url(#body-${id})`} />
        <path d="M94 84 Q113 83 113 98 Q111 106 97 101 L88 95" fill={`url(#body-${id})`} />
        <path d="M48 117 L45 130 Q47 138 60 136 L64 127" fill={`url(#shell-${id})`} />
        <path d="M80 117 L83 130 Q81 138 68 136 L64 127" fill={`url(#shell-${id})`} />
        <rect x="31" y="33" width="66" height="91" rx="31" fill={`url(#body-${id})`} strokeWidth="5" />
        <path d="M37 57 Q63 50 91 57" fill="none" stroke={`url(#shell-${id})`} strokeWidth="8" />
        <path d="M42 47 Q47 39 52 45" fill="none" stroke="#fff" strokeWidth="4" opacity=".9" />
      </g>
      <g>
        {isWarm ? <><path d="M47 75 Q53 71 58 75M70 75 Q76 71 81 75" fill="none" stroke="#33435d" strokeWidth="3.5" strokeLinecap="round"/><path d="M56 92 Q65 97 74 90" fill="none" stroke="#9e4850" strokeWidth="3" strokeLinecap="round"/></> : <><ellipse cx="52" cy="75" rx="4" ry="6" fill="#28374c"/><ellipse cx="76" cy="75" rx="4" ry="6" fill="#28374c"/><path d="M57 90 Q64 96 71 90" fill="none" stroke="#ad5a65" strokeWidth="3" strokeLinecap="round"/></>}
        <ellipse cx="43" cy="86" rx="6" ry="3.5" fill="#f7a4a0" opacity=".72"/><ellipse cx="85" cy="86" rx="6" ry="3.5" fill="#f7a4a0" opacity=".72"/>
      </g>
      <g transform="translate(63 108)">
        {id === 'PNN' && <path d="M0 6 Q-12 -1 -9 -9 Q-2 -9 1 0 Q6 -8 12 -5 Q12 3 2 7Z" fill="#78be43" stroke="#4c8d36" strokeWidth="2"/>}
        {id === 'QCC' && <path d="m0 -8 2.5 5.3 5.8.8-4.2 4.1 1 5.8L0 3.3-5.1 6l1-5.8-4.2-4.1 5.8-.8Z" fill="#ffda70" stroke="#9c72d6" strokeWidth="2" strokeLinejoin="round"/>}
        {id === 'REE' && <path d="M0 7 C-13 0 -3 -4 0 -11 C4 -4 13 0 0 7Z" fill="#ff9b43" stroke="#df5b58" strokeWidth="2"/>}
        {id === 'KTT' && <path d="M0 -8 8 0 0 8-8 0Z" fill="#ffd176" stroke="#bb7735" strokeWidth="2"/>}
        {id === 'COO' && <><circle r="8" fill="#fff6d5" stroke="#b18e29" strokeWidth="2.5"/><circle r="3" fill="#edc33f"/></>}
      </g>
    </svg>
  );
}

export function JellyTile({ color, selected, fog, lockHits, dimmed }: {
  color: JellyColor; selected: boolean; fog?: number; lockHits?: number; dimmed?: boolean;
}) {
  return (
    <span className={`jelly-art jelly-art--${color}${selected ? ' is-selected' : ''}${dimmed ? ' is-dimmed' : ''}`}>
      <img src={`${import.meta.env.BASE_URL}assets/jellies/${color}.webp`} alt="" draggable="false" />
      {fog ? <span className="jelly-fog" aria-hidden="true"><i /><i /></span> : null}
      {lockHits ? <span className={`jelly-lock${lockHits > 1 ? ' jelly-lock--stone' : ''}`} aria-hidden="true">{lockHits > 1 ? '✦' : '⌑'}</span> : null}
    </span>
  );
}

const EYE = <><ellipse cx="91" cy="76" rx="25" ry="31" fill="#fff" stroke="#35476b" strokeWidth="5"/><ellipse cx="97" cy="78" rx="10" ry="15" fill="#6eb5d9"/><circle cx="100" cy="71" r="4" fill="#fff"/><ellipse cx="143" cy="76" rx="25" ry="31" fill="#fff" stroke="#35476b" strokeWidth="5"/><ellipse cx="137" cy="78" rx="10" ry="15" fill="#6eb5d9"/><circle cx="134" cy="71" r="4" fill="#fff"/><path d="M113 120 Q124 128 135 120" stroke="#405276" strokeWidth="5" fill="none" strokeLinecap="round"/></>;

export function EnemyArt({ kind, hurt = false }: { kind: string; hurt?: boolean }) {
  return (
    <svg className={`enemy-art${hurt ? ' enemy-art--hurt' : ''}`} viewBox="0 0 220 160" role="img" aria-label="卡通敵人">
      <defs>
        <linearGradient id="foe-green" x1="0" x2="1" y1="0" y2="1"><stop stopColor="#bcf486"/><stop offset="1" stopColor="#50ae9a"/></linearGradient>
        <linearGradient id="foe-purple" x1="0" x2="1" y1="0" y2="1"><stop stopColor="#d4b7ff"/><stop offset="1" stopColor="#7f73cc"/></linearGradient>
        <linearGradient id="foe-orange" x1="0" x2="1" y1="0" y2="1"><stop stopColor="#ffc677"/><stop offset="1" stopColor="#ed765d"/></linearGradient>
        <filter id="foe-shadow" x="-30%" y="-30%" width="160%" height="180%"><feDropShadow dx="0" dy="5" stdDeviation="4" floodColor="#313758" floodOpacity=".19"/></filter>
      </defs>
      <ellipse cx="111" cy="144" rx="71" ry="9" fill="#314677" opacity=".09" />
      <DiseaseEnemyArt kind={kind} />
      {kind === 'bacteria' && <g filter="url(#foe-shadow)"><path d="M42 78 26 68 41 61 34 43 52 48 61 28 72 43 91 32 96 51 117 47 112 63 130 72 117 83 125 99 105 102 100 119 80 111 68 126 59 108 40 109 47 91 33 85Z" fill="url(#foe-green)" stroke="#428c83" strokeWidth="5" strokeLinejoin="round"/><ellipse cx="67" cy="76" rx="5" ry="8" fill="#34405a"/><ellipse cx="94" cy="76" rx="5" ry="8" fill="#34405a"/><path d="M70 94 Q82 104 96 93" fill="none" stroke="#3f6371" strokeWidth="4" strokeLinecap="round"/><circle cx="153" cy="104" r="18" fill="#ffd773" stroke="#efaa54" strokeWidth="4"/><circle cx="149" cy="101" r="2.8" fill="#34405a"/><circle cx="158" cy="101" r="2.8" fill="#34405a"/><path d="M149 110q5 5 10 0" stroke="#996351" strokeWidth="2.5" fill="none" strokeLinecap="round"/><circle cx="165" cy="49" r="9" fill="#96e2a1"/><circle cx="179" cy="61" r="5" fill="#bd9aff"/><path d="M38 90 23 98m92-16 16-8m-80 27-8 16" stroke="#528f85" strokeWidth="5" strokeLinecap="round"/></g>}
      {kind === 'cold' && <g filter="url(#foe-shadow)"><path d="M42 100Q21 94 29 76q5-14 20-13 2-29 30-29 18 0 28 16 26-10 41 9 24 1 25 23 1 21-22 23H48Z" fill="#a8dcf5" stroke="#70aecb" strokeWidth="5"/><ellipse cx="78" cy="78" rx="4" ry="7" fill="#3c5270"/><ellipse cx="112" cy="78" rx="4" ry="7" fill="#3c5270"/><path d="M84 94q11-10 23 0" fill="none" stroke="#647f9d" strokeWidth="4" strokeLinecap="round"/><path d="M152 92q25 8 8 27-8 8-22 7" fill="none" stroke="#71b5dc" strokeWidth="6" strokeLinecap="round"/><circle cx="54" cy="48" r="8" fill="#dbf5ff"/><path d="m170 38 6 12h-12zM38 112l5 10h-10z" fill="#8bc9ed"/></g>}
      {kind === 'sleepy' && <g filter="url(#foe-shadow)"><path d="M47 110q-17-13-13-34t24-25q8-29 41-31 32 2 42 29 29 8 31 36-4 31-35 35H66Z" fill="#a9b4ce" stroke="#7988aa" strokeWidth="5"/><path d="M69 77q10 11 20 0m20 0q10 11 20 0" fill="none" stroke="#58637e" strokeWidth="5" strokeLinecap="round"/><path d="M84 99q16-4 31 0" fill="none" stroke="#717c96" strokeWidth="4" strokeLinecap="round"/><path d="M155 51q15-24 24 0t-9 28q22 3 14 23" fill="#ece9fd" stroke="#a49ac8" strokeWidth="3"/><text x="165" y="84" fill="#8d83b6" fontSize="16" fontWeight="900">Z</text></g>}
      {kind === 'forgetful' && <g filter="url(#foe-shadow)"><path d="M52 108q-15-12-10-35 4-20 25-26 7-20 32-20 26 0 36 23 27 1 31 26 1 29-28 37H69Z" fill="url(#foe-purple)" stroke="#8170bb" strokeWidth="5"/><ellipse cx="82" cy="76" rx="4" ry="7" fill="#42436d"/><ellipse cx="118" cy="76" rx="4" ry="7" fill="#42436d"/><path d="M91 96q10-9 20 0" fill="none" stroke="#5a547d" strokeWidth="4" strokeLinecap="round"/><path d="M130 39q2-23 19-18 15 5 8 20 20-10 23 8 2 17-20 15" fill="#f3edff" stroke="#9c8bce" strokeWidth="4"/><text x="144" y="51" fill="#7b69b6" fontSize="22" fontWeight="900">?</text><path d="M46 58 31 48l17 1m111 65 17 5-14 8" fill="none" stroke="#dbca68" strokeWidth="4" strokeLinecap="round"/></g>}
      {kind === 'blur' && <g filter="url(#foe-shadow)"><path d="M43 112q-13-21 3-37-5-29 25-34 12-30 43-24 18-17 40 1 27 1 32 28 18 20 4 39 7 24-22 35H61Z" fill="url(#foe-purple)" stroke="#766fb8" strokeWidth="5"/><g>{EYE}</g><path d="M22 106q18-15 33-1m112-59q25-15 38 4" fill="none" stroke="#eef5ff" strokeWidth="8" opacity=".78" strokeLinecap="round"/><circle cx="36" cy="87" r="9" fill="#eef5ff" opacity=".6"/><circle cx="181" cy="104" r="12" fill="#e0eaff" opacity=".75"/></g>}
      {kind === 'three-high' && <g filter="url(#foe-shadow)"><path d="m51 120 5-35 47-12 14 13 43-4 13 38-19 11H65Z" fill="#7d91c3" stroke="#536892" strokeWidth="5" strokeLinejoin="round"/><ellipse cx="68" cy="49" rx="29" ry="31" fill="#f28b77" stroke="#b65461" strokeWidth="5"/><ellipse cx="112" cy="35" rx="29" ry="31" fill="#90c8ec" stroke="#578bb5" strokeWidth="5"/><ellipse cx="155" cy="51" rx="29" ry="31" fill="#f2c671" stroke="#be8c45" strokeWidth="5"/><circle cx="60" cy="48" r="4" fill="#394665"/><circle cx="75" cy="48" r="4" fill="#394665"/><circle cx="105" cy="33" r="4" fill="#394665"/><circle cx="120" cy="33" r="4" fill="#394665"/><circle cx="148" cy="50" r="4" fill="#394665"/><circle cx="163" cy="50" r="4" fill="#394665"/><path d="M61 63q7 5 14 0m23-14q7 5 14 0m22 16q7 5 14 0" fill="none" stroke="#79526b" strokeWidth="3" strokeLinecap="round"/><path d="M39 108h20m65 5h23" stroke="#c6d9f2" strokeWidth="5" strokeLinecap="round"/></g>}
      {kind === 'slime' && <g filter="url(#foe-shadow)"><path d="M41 117Q22 100 33 77q8-16 27-13 2-39 39-37 28 0 35 26 26-8 40 11 17 27-3 51-16 18-45 14Z" fill="url(#foe-orange)" stroke="#d87857" strokeWidth="5"/><ellipse cx="78" cy="78" rx="5" ry="7" fill="#533d53"/><ellipse cx="119" cy="78" rx="5" ry="7" fill="#533d53"/><path d="M86 97q12 9 24-1" fill="none" stroke="#9b4d56" strokeWidth="4" strokeLinecap="round"/><path d="M50 117q3 21 20 15 11-4 7-17m56 0q-1 25 15 20 10-4 9-18" fill="#a1dc90" stroke="#64a781" strokeWidth="4"/><circle cx="154" cy="48" r="8" fill="#d9ffb2" opacity=".8"/><circle cx="51" cy="49" r="5" fill="#f6e2a1"/></g>}
      {kind === 'joint' && <g filter="url(#foe-shadow)"><path d="M55 38 70 24 87 34 103 18 123 34 144 27 156 47 174 56 161 74 171 95 151 106 149 127 125 122 107 139 91 122 67 129 63 109 42 99 53 80 39 61Z" fill="#abb5ca" stroke="#737f9c" strokeWidth="6" strokeLinejoin="round"/><path d="m49 39 9-20 11 20m71 1 12-18 7 24" fill="#d9deea" stroke="#7986a4" strokeWidth="5" strokeLinejoin="round"/><ellipse cx="82" cy="76" rx="7" ry="10" fill="#343e5b"/><ellipse cx="128" cy="76" rx="7" ry="10" fill="#343e5b"/><path d="M91 100q13 12 26 0" fill="none" stroke="#666f89" strokeWidth="5" strokeLinecap="round"/><path d="m54 104-16 23 31 7m88-33 24 17-19 13" fill="#929fba" stroke="#737f9c" strokeWidth="5" strokeLinejoin="round"/><path d="m71 67 12-7m34 7 12-7" stroke="#e1b86d" strokeWidth="6" strokeLinecap="round"/></g>}
    </svg>
  );
}

export function CharacterFigure({ id }: { id: CharacterId }) {
  const cfg = CHARACTERS[id];
  return <div className={`character-figure character-figure--${id.toLowerCase()}`}><CharacterArt id={id} /><span>{cfg.symbol}</span></div>;
}
