import React from 'react';
import { Cog } from 'lucide-react';

export type SuiteModuleId = 'fact' | 'conta' | 'stock' | 'admin';

/** Decorative, code-native illustrations keep the module cards sharp at every size. */
export function ModuleArtwork({ module }: { module: SuiteModuleId }) {
  const colors = { fact: ['#0874ef', '#0052c9'], conta: ['#46ca86', '#159956'], stock: ['#ffa63d', '#ef6810'], admin: ['#9765f7', '#6131ce'] };
  const [light, dark] = colors[module];
  const fill = `url(#${module}-color)`;
  return <div className={`suite-art suite-art-${module}`} aria-hidden="true">
    <svg viewBox="0 0 240 170" fill="none" focusable="false">
      <defs>
        <linearGradient id={`${module}-paper`} x1="60" y1="20" x2="180" y2="145" gradientUnits="userSpaceOnUse"><stop stopColor="white" /><stop offset="1" stopColor={module === 'conta' ? '#e6fff0' : '#e9f6ff'} /></linearGradient>
        <linearGradient id={`${module}-color`} x1="55" y1="25" x2="190" y2="160" gradientUnits="userSpaceOnUse"><stop stopColor={light} /><stop offset="1" stopColor={dark} /></linearGradient>
        <filter id={`${module}-shadow`} x="-30%" y="-30%" width="170%" height="180%"><feDropShadow dx="0" dy="8" stdDeviation="7" floodColor={dark} floodOpacity=".19" /></filter>
      </defs>
      <ellipse cx="120" cy="151" rx="77" ry="9" fill={dark} opacity=".09" />
      {module === 'fact' && <g filter={`url(#${module}-shadow)`}>
        <rect x="66" y="19" width="92" height="122" rx="11" fill="#61b5ff" opacity=".36" transform="rotate(6 66 19)" />
        <path d="M66 15h66l22 23v102a8 8 0 0 1-8 8H66a8 8 0 0 1-8-8V23a8 8 0 0 1 8-8Z" fill={`url(#${module}-paper)`} />
        <path d="M132 15v15a8 8 0 0 0 8 8h14" fill="#cbe8ff" />
        <path d="M75 39h38M75 55h54M75 71h47M75 87h29" stroke="#8fbfe6" strokeWidth="6" strokeLinecap="round" />
        <g stroke="#72a6d1" strokeWidth="3"><rect x="75" y="105" width="13" height="13" /><rect x="94" y="105" width="13" height="13" /><rect x="75" y="124" width="13" height="13" /><path d="M96 126h11v10M100 122v9M93 136h4" /></g>
        <circle cx="155" cy="117" r="34" fill={fill} stroke="#63b9ff" strokeWidth="2" />
        <path d="M145 133c0-18 4-23 20-23m-8-9 10 9-10 9" stroke="white" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      </g>}
      {module === 'conta' && <g filter={`url(#${module}-shadow)`}>
        <rect x="65" y="24" width="93" height="122" rx="11" fill="#63cc8a" opacity=".3" transform="rotate(5 65 24)" />
        <rect x="55" y="16" width="98" height="128" rx="11" fill={`url(#${module}-paper)`} />
        <path d="M73 38h45M73 55h40M73 72h28" stroke="#81cfa1" strokeWidth="6" strokeLinecap="round" />
        <rect x="74" y="110" width="10" height="20" rx="3" fill="#5bc489" /><rect x="91" y="98" width="10" height="32" rx="3" fill="#43b678" /><rect x="108" y="87" width="10" height="43" rx="3" fill="#28a968" />
        <path d="M165 82a32 32 0 1 0 31 33h-31V82Z" fill={fill} stroke="#b1edc7" strokeWidth="2" />
        <path d="M172 75v32h32a32 32 0 0 0-32-32Z" fill="#6bdd9b" stroke="#baf4d2" strokeWidth="2" />
      </g>}
      {module === 'stock' && <g filter={`url(#${module}-shadow)`}>
        <path d="m50 84 39-8 39 9v56l-40 7-38-8V84Z" fill={fill} /><path d="m50 84 38 8 40-7-39-9-39 8Z" fill="#ffc268" /><path d="M88 92v56" stroke="#d66b15" strokeWidth="2" />
        <path d="m121 84 37-8 39 9v56l-39 7-37-8V84Z" fill={fill} /><path d="m121 84 37 8 39-7-39-9-37 8Z" fill="#ffc268" /><path d="M158 92v56" stroke="#d66b15" strokeWidth="2" />
        <path d="m84 25 34-7 39 8v53l-38 8-35-7V25Z" fill={fill} /><path d="m84 25 35 7 38-6-39-8-34 7Z" fill="#ffc871" /><path d="M119 32v55" stroke="#e28020" strokeWidth="2" /><path d="m103 22 17 3 17-3v19l-17 3-17-4V22Z" fill="#e68422" />
        <rect x="136" y="105" width="44" height="32" rx="4" fill="#fffaf0" /><path d="M144 112v18m4-18v18m5-18v18m4-18v18m6-18v18m4-18v18m5-18v18" stroke="#533a2d" strokeWidth="2" />
      </g>}
      {module === 'admin' && <g filter={`url(#${module}-shadow)`}>
        <circle cx="75" cy="74" r="15" fill={fill} /><path d="M49 128v-17a26 26 0 0 1 52 0v17H49Z" fill={fill} />
        <circle cx="165" cy="69" r="15" fill={fill} /><path d="M139 125v-15a26 26 0 0 1 52 0v15h-52Z" fill={fill} />
        <circle cx="118" cy="55" r="19" fill={fill} /><path d="M83 135v-22a35 35 0 0 1 70 0v22H83Z" fill={fill} stroke="#ad8df3" strokeWidth="1.5" />
      </g>}
    </svg>
    {module === 'admin' && <Cog className="suite-art-gear" strokeWidth={2.5} />}
  </div>;
}
