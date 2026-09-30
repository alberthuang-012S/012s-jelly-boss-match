function Face({ x = 110, y = 80, sleepy = false }: { x?: number; y?: number; sleepy?: boolean }) {
  return <g transform={`translate(${x} ${y})`} stroke="#43516b" strokeWidth="3.5" strokeLinecap="round">
    {sleepy ? <path d="M-22-2q7-7 14 0M8-2q7-7 14 0" fill="none"/> : <g fill="#43516b" stroke="none"><ellipse cx="-15" rx="4" ry="6"/><ellipse cx="15" rx="4" ry="6"/><circle cx="-16" cy="-2" r="1.5" fill="#fff"/><circle cx="14" cy="-2" r="1.5" fill="#fff"/></g>}
    <path d="M-9 17q9 7 18 0" fill="none"/>
    <g fill="#eea6a7" opacity=".6" stroke="none"><ellipse cx="-25" cy="11" rx="6" ry="3"/><ellipse cx="25" cy="11" rx="6" ry="3"/></g>
  </g>;
}

/** Playful disease and pathogen characters, drawn in the game's existing SVG style. */
export function DiseaseEnemyArt({ kind }: { kind: string }) {
  switch (kind) {
    case 'capsule': return <g filter="url(#foe-shadow)">
      <path d="M42 72q-24-17-22 4t25 21m134-28q26-19 24 2t-25 23" fill="none" stroke="#78aebb" strokeWidth="5" strokeLinecap="round"/>
      <rect x="38" y="27" width="144" height="108" rx="52" fill="#e4f6f8" fillOpacity=".8" stroke="#92cbd5" strokeWidth="4"/>
      <rect x="54" y="42" width="112" height="78" rx="38" fill="#88c2bc" stroke="#55958f" strokeWidth="4"/>
      <path d="M61 53q14-17 35-14" fill="none" stroke="#fff" strokeWidth="6" strokeLinecap="round"/>
      <path d="m111 105-15 5v11q15 17 30 0v-11Z" fill="#e4d38d" stroke="#b4a260" strokeWidth="3"/>
      <Face y={76}/>
    </g>;
    case 'biofilm': return <g filter="url(#foe-shadow)">
      <path d="M30 119q-7-15 7-25-15-19 3-33 11-12 23-6 4-30 32-30 19-13 37 5 25-3 30 22 25 0 27 26 14 22-4 37-65 21-155 4Z" fill="#c8e8e2" stroke="#78b4ab" strokeWidth="4"/>
      <g fill="#effbf8" stroke="#9ccac3" strokeWidth="3"><circle cx="55" cy="74" r="23"/><circle cx="94" cy="49" r="23"/><circle cx="153" cy="67" r="25"/><circle cx="171" cy="101" r="17"/><circle cx="71" cy="107" r="24"/></g>
      <ellipse cx="109" cy="89" rx="39" ry="34" fill="#b4a3d8" stroke="#8574ac" strokeWidth="4"/>
      <Face y={82}/><path d="M39 126q65 16 146-1" fill="none" stroke="#7fb8ae" strokeWidth="6" strokeLinecap="round"/>
    </g>;
    case 'crystal': return <g filter="url(#foe-shadow)" stroke="#b89e76" strokeWidth="4" strokeLinejoin="round">
      <path d="m51 65 20-33 36-8 42 10 25 34-8 49-35 19-46-7-36-24Z" fill="#e8d4b0"/>
      <path d="m71 32 13 36 23-44 19 43 23-33M51 65l33 3-35 37 43-2-7 26m7-26 39 33-5-69 40 50-5-44" fill="none" stroke="#c8b08b" strokeWidth="3"/>
      <path d="m50 116-21 12 32 6m101-18 24 13-29 6" fill="#dfc7a0"/>
      <path d="m159 39 8-16 12 12-7 19M37 84l-14-8 3-16 15 11" fill="#f5e9ca"/>
      <Face y={81}/><path d="m97 113 7-11 9 8-4 12" fill="none" stroke="#9b896f" strokeWidth="3"/>
    </g>;
    case 'superbug': return <g filter="url(#foe-shadow)" stroke="#668897" strokeWidth="4" strokeLinejoin="round">
      <path d="M46 92 27 81l-5 28 30 9m119-26 22-11 4 29-31 7" fill="#b1cdd0"/>
      <path d="M52 120V50l15-10 16 11 17-16 19 14 17-15 16 16 15-8 11 11v69q-63 26-126-2Z" fill="#a7c6c7"/>
      <path d="M60 69q49-28 110 0v43q-55 26-110 0Z" fill="#d6e5df"/>
      <path d="m110 52-31 22 7 35 24 18 24-18 7-35Z" fill="#88b0b0"/>
      <path d="m88 37-9-22 22 11 10-19 11 19 22-11-10 22Z" fill="#efcb77" stroke="#b29a5c"/>
      <Face y={80}/><path d="M35 48v12m-6-6h12m144-14v12m-6-6h12" stroke="#e4bb72" strokeWidth="3" strokeLinecap="round"/>
    </g>;
    case 'rhinitis': return <g filter="url(#foe-shadow)">
      <path d="M55 119q-27-11-20-35 1-19 25-23-1-25 25-31 23-13 42 10 27-7 37 21 26 4 24 30-1 31-36 32Z" fill="#f3c0c9" stroke="#c98a9d" strokeWidth="4"/>
      <Face y={76} sleepy/><ellipse cx="110" cy="89" rx="12" ry="9" fill="#dc7b90" stroke="#b66380" strokeWidth="3"/>
      <path d="m113 96 18 32 31-10-21-24Z" fill="#fffaf2" stroke="#cfc5d4" strokeWidth="3"/>
      <path d="M156 43q21-10 31 1m-18 15 23 3" fill="none" stroke="#a5ccdb" strokeWidth="5" strokeLinecap="round"/>
      <circle cx="180" cy="79" r="5" fill="#b7d9e5"/><circle cx="38" cy="48" r="5" fill="#e6cd82"/>
    </g>;
    case 'mucus': return <g filter="url(#foe-shadow)" stroke="#81a982" strokeWidth="4" strokeLinejoin="round">
      <path d="M52 117q-25-18-13-39 5-18 28-19 2-27 31-31 32-3 42 22 28-2 35 24 20 27-1 43-5 10-1 17-18 8-21-12-15 29-32 4-12 15-30-2-12 21-25 5Z" fill="#b8dca5"/>
      <path d="M157 117q32 8 38 0t-6-14" fill="none" stroke="#a4c88c" strokeWidth="10" strokeLinecap="round"/>
      <Face y={79}/><ellipse cx="110" cy="94" rx="11" ry="8" fill="#9ac47d" stroke="#7d9f69" strokeWidth="2"/>
      <path d="M111 101v17q5 14 12 2" fill="none" stroke="#e1e9a7" strokeWidth="6" strokeLinecap="round"/>
      <g fill="#e9f5d0" stroke="none"><circle cx="63" cy="60" r="7"/><circle cx="151" cy="83" r="5"/></g>
    </g>;
    case 'bronchus': return <g filter="url(#foe-shadow)" strokeLinecap="round" strokeLinejoin="round">
      <path d="M109 24v34m0-7L80 79m29-28 31 28M80 79 52 66m28 13-16 35m76-35 28-13m-28 13 16 35" fill="none" stroke="#b6778e" strokeWidth="17"/>
      <path d="M109 24v34m0-7L80 79m29-28 31 28M80 79 52 66m28 13-16 35m76-35 28-13m-28 13 16 35" fill="none" stroke="#efb3c2" strokeWidth="9"/>
      <path d="M42 124q-20-21-2-58 9-29 34-25 23 4 24 47-4 45-56 36Zm136 0q20-21 2-58-9-29-34-25-23 4-24 47 4 45 56 36Z" fill="#edb3ba" fillOpacity=".82" stroke="#bc8799" strokeWidth="4"/>
      <g stroke="#cd929e" strokeWidth="3" fill="none"><path d="m65 69 13 12-19 8m94-20-13 12 19 8"/></g>
      <Face y={88}/><path d="M39 129q18 9 28-3m87 3q18 9 28-3" fill="none" stroke="#bad6dd" strokeWidth="5"/>
    </g>;
    case 'influenza': return <g filter="url(#foe-shadow)">
      {Array.from({ length: 10 }, (_, index) => <g key={index} transform={`translate(110 80) rotate(${index * 36})`} stroke="#927aa9" strokeWidth="4" strokeLinecap="round"><path d="M0-47v-16"/><ellipse cy="-63" rx="10" ry="5" fill={index % 2 ? '#a5cfce' : '#efb3c5'}/></g>)}
      <circle cx="110" cy="80" r="49" fill="#c1a7db" stroke="#927aa9" strokeWidth="5"/>
      <g fill="#e2c8ed" opacity=".85"><circle cx="84" cy="52" r="8"/><circle cx="143" cy="78" r="7"/><circle cx="93" cy="112" r="6"/></g>
      <Face y={77}/><ellipse cx="111" cy="91" rx="7" ry="5" fill="#d88ea6"/>
      <path d="M33 109q13 27 48 21m59-97q40-14 50 11M174 117l17-3-8 15" fill="none" stroke="#b4d5e1" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round"/>
    </g>;
    default: return null;
  }
}
