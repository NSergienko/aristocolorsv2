/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Production-grade, zero-failure SVG artworks crafted for concept art & photobashing

export const SVG_ARTWORKS = {
  // 1. Cyberpunk Neo-Tokyo Overpass
  cyberpunk: `data:image/svg+xml;utf8,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 450" width="100%" height="100%">
      <defs>
        <linearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#0a051b"/>
          <stop offset="60%" stop-color="#140f2d"/>
          <stop offset="100%" stop-color="#241142"/>
        </linearGradient>
        <linearGradient id="neonPink" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="#ff007f"/>
          <stop offset="100%" stop-color="#ff00cc"/>
        </linearGradient>
        <linearGradient id="neonCyan" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="#00f0ff"/>
          <stop offset="100%" stop-color="#00a8ff"/>
        </linearGradient>
        <linearGradient id="overpassMetal" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#2a3147"/>
          <stop offset="50%" stop-color="#171b29"/>
          <stop offset="100%" stop-color="#0d101a"/>
        </linearGradient>
        <linearGradient id="roadReflect" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#121626"/>
          <stop offset="100%" stop-color="#070913"/>
        </linearGradient>
        <filter id="neonGlow">
          <feGaussianBlur stdDeviation="3" result="blur"/>
          <feMerge>
            <feMergeNode in="blur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>

      <!-- Night Sky -->
      <rect width="800" height="450" fill="url(#skyGrad)"/>

      <!-- Distant Skyscrapers Silhouette -->
      <polygon points="40,280 40,110 80,110 80,80 90,80 90,110 130,110 130,280" fill="#0f1324" opacity="0.8"/>
      <polygon points="140,280 140,140 180,140 180,280" fill="#0d111f" opacity="0.8"/>
      <polygon points="210,280 210,60 260,60 270,40 280,60 310,60 310,280" fill="#13182b"/>
      <polygon points="330,280 330,130 380,130 380,280" fill="#0d101d"/>
      <polygon points="400,280 400,90 440,90 450,70 460,90 490,90 490,280" fill="#14192e"/>
      <polygon points="510,280 510,120 570,120 570,280" fill="#0e1222"/>
      <polygon points="600,280 600,70 660,70 670,50 680,70 730,70 730,280" fill="#13192d"/>
      <polygon points="740,280 740,150 780,150 780,280" fill="#0d1120"/>

      <!-- Skyscraper Windows (Lit) -->
      <g fill="#ffe680" opacity="0.6">
        <rect x="225" y="80" width="3" height="4"/>
        <rect x="235" y="80" width="3" height="4"/>
        <rect x="245" y="80" width="3" height="4"/>
        <rect x="225" y="95" width="3" height="4"/>
        <rect x="245" y="95" width="3" height="4"/>
        <rect x="235" y="110" width="3" height="4"/>
        <rect x="225" y="125" width="3" height="4"/>
        <rect x="235" y="125" width="3" height="4"/>
        <rect x="420" y="110" width="3" height="5"/>
        <rect x="430" y="110" width="3" height="5"/>
        <rect x="420" y="130" width="3" height="5"/>
        <rect x="620" y="90" width="3" height="4"/>
        <rect x="635" y="90" width="3" height="4"/>
        <rect x="650" y="90" width="3" height="4"/>
        <rect x="620" y="110" width="3" height="4"/>
        <rect x="650" y="110" width="3" height="4"/>
      </g>

      <!-- Neon Billboards in Background -->
      <g filter="url(#neonGlow)">
        <rect x="220" y="150" width="60" height="18" fill="#ff007f" opacity="0.85" rx="2"/>
        <text x="250" y="163" fill="#ffffff" font-size="10" font-family="sans-serif" font-weight="bold" text-anchor="middle">ARISTO</text>

        <rect x="615" y="130" width="70" height="20" fill="#00f0ff" opacity="0.8" rx="2"/>
        <text x="650" y="144" fill="#0a051b" font-size="9" font-family="sans-serif" font-weight="bold" text-anchor="middle">NEO TOKYO</text>
      </g>

      <!-- Highway Double-Decker Flyover -->
      <polygon points="0,220 800,160 800,200 0,260" fill="url(#overpassMetal)"/>
      <polygon points="0,260 800,200 800,208 0,268" fill="#6f00ff" opacity="0.6"/>
      <!-- Lower Highway Span -->
      <polygon points="0,290 800,230 800,270 0,330" fill="url(#overpassMetal)"/>
      <polygon points="0,330 800,270 800,278 0,338" fill="#38bdf8" opacity="0.7"/>

      <!-- Structural Concrete Pillars -->
      <polygon points="120,240 160,237 155,420 125,420" fill="#1b2030"/>
      <polygon points="380,220 420,217 415,420 385,420" fill="#151928"/>
      <polygon points="640,200 680,197 675,420 645,420" fill="#181d2c"/>

      <!-- Lower Ground Wet Asphalt -->
      <rect x="0" y="360" width="800" height="90" fill="url(#roadReflect)"/>

      <!-- Wet Surface Reflections -->
      <ellipse cx="260" cy="400" rx="90" ry="12" fill="#ff007f" opacity="0.22"/>
      <ellipse cx="640" cy="395" rx="110" ry="14" fill="#00f0ff" opacity="0.25"/>
      <ellipse cx="450" cy="410" rx="70" ry="10" fill="#6f00ff" opacity="0.3"/>

      <!-- Traffic Light Streaks on Overpass -->
      <path d="M0,230 Q400,185 800,172" stroke="#ff0055" stroke-width="2.5" fill="none" opacity="0.85" filter="url(#neonGlow)"/>
      <path d="M0,235 Q400,190 800,177" stroke="#ff2a00" stroke-width="1.8" fill="none" opacity="0.7"/>
      <path d="M800,186 Q400,200 0,245" stroke="#00f0ff" stroke-width="2" fill="none" opacity="0.8" filter="url(#neonGlow)"/>
      <path d="M800,190 Q400,204 0,249" stroke="#ffffff" stroke-width="1.5" fill="none" opacity="0.9"/>

      <!-- Volumetric Atmospheric Fog and Rain streaks -->
      <g stroke="#38bdf8" stroke-width="0.7" opacity="0.18">
        <line x1="50" y1="50" x2="40" y2="120"/>
        <line x1="150" y1="120" x2="140" y2="190"/>
        <line x1="280" y1="40" x2="270" y2="110"/>
        <line x1="390" y1="160" x2="380" y2="230"/>
        <line x1="520" y1="80" x2="510" y2="150"/>
        <line x1="680" y1="140" x2="670" y2="210"/>
        <line x1="720" y1="260" x2="710" y2="330"/>
        <line x1="180" y1="300" x2="170" y2="370"/>
        <line x1="440" y1="320" x2="430" y2="390"/>
      </g>

      <!-- Label Badge -->
      <rect x="20" y="20" width="130" height="22" rx="4" fill="#0d101a" opacity="0.85" stroke="#6f00ff" stroke-width="1"/>
      <text x="85" y="35" fill="#d7deed" font-family="'JetBrains Mono', monospace" font-size="10" font-weight="600" text-anchor="middle">MATTE PLATE · 4K</text>
    </svg>
  `)}`,

  // 2. Nordic Shrine in Mist Valley
  nordic: `data:image/svg+xml;utf8,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 450" width="100%" height="100%">
      <defs>
        <linearGradient id="mistSky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#192338"/>
          <stop offset="45%" stop-color="#3d4e68"/>
          <stop offset="70%" stop-color="#7c8ea3"/>
          <stop offset="100%" stop-color="#a4b4c4"/>
        </linearGradient>
        <linearGradient id="godRay" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#ffeedb" stop-opacity="0.35"/>
          <stop offset="100%" stop-color="#ffeedb" stop-opacity="0"/>
        </linearGradient>
        <linearGradient id="rockGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#2c3647"/>
          <stop offset="100%" stop-color="#141a24"/>
        </linearGradient>
      </defs>

      <!-- Misty Morning Sky -->
      <rect width="800" height="450" fill="url(#mistSky)"/>

      <!-- Distant Mountain Peaks (High Contrast Atmospheric Perspective) -->
      <polygon points="0,260 120,130 220,190 340,90 480,220 580,120 720,210 800,160 800,450 0,450" fill="#46546b" opacity="0.5"/>
      <polygon points="0,310 160,180 280,240 420,150 560,260 690,170 800,240 800,450 0,450" fill="#2d384c" opacity="0.75"/>
      <polygon points="0,350 200,230 360,290 510,210 650,300 800,250 800,450 0,450" fill="#1e2738"/>

      <!-- Painterly God Rays Through Fog -->
      <polygon points="260,0 360,0 520,450 320,450" fill="url(#godRay)"/>
      <polygon points="400,0 480,0 720,450 580,450" fill="url(#godRay)" opacity="0.6"/>

      <!-- Midground Pine Forest Ridges -->
      <g fill="#141c29">
        <!-- Pine silhouettes -->
        <polygon points="50,340 60,300 70,340"/>
        <polygon points="65,345 75,305 85,345"/>
        <polygon points="80,340 90,290 100,340"/>
        <polygon points="120,350 130,310 140,350"/>
        <polygon points="680,330 690,290 700,330"/>
        <polygon points="700,335 710,295 720,335"/>
        <polygon points="730,340 740,285 750,340"/>
      </g>

      <!-- Foreground Grassy Valley Ridge -->
      <path d="M0,380 Q250,340 500,370 T800,360 L800,450 L0,450 Z" fill="#121824"/>
      <path d="M0,400 Q200,370 420,400 T800,390 L800,450 L0,450 Z" fill="#0d121c"/>

      <!-- Ancient Monolith Shrine Ruins (Center-Left) -->
      <!-- Left Standing Stone -->
      <polygon points="220,390 235,260 255,255 265,385" fill="url(#rockGrad)"/>
      <polygon points="235,260 255,255 258,385 245,390" fill="#3e4a5d" opacity="0.6"/>
      <!-- Right Standing Stone -->
      <polygon points="310,385 320,250 340,245 355,380" fill="url(#rockGrad)"/>
      <!-- Top Lintel Slab Stone -->
      <polygon points="205,265 240,240 370,230 365,255" fill="#323d50"/>
      <polygon points="205,265 365,255 355,270 215,280" fill="#1c2330"/>

      <!-- Foreground Fallen Stone with Moss Highlight -->
      <polygon points="370,390 440,375 460,400 390,415" fill="#1f2735"/>
      <path d="M380,385 Q420,375 445,380" stroke="#4ade80" stroke-width="2.5" fill="none" opacity="0.75"/>

      <!-- Ambient Mist Band Layer -->
      <rect x="0" y="320" width="800" height="40" fill="#a4b4c4" opacity="0.2" filter="blur(6px)"/>

      <!-- Label Badge -->
      <rect x="20" y="20" width="145" height="22" rx="4" fill="#0d101a" opacity="0.85" stroke="#38bdf8" stroke-width="1"/>
      <text x="92" y="35" fill="#d7deed" font-family="'JetBrains Mono', monospace" font-size="10" font-weight="600" text-anchor="middle">NORDIC FJORD · RAW</text>
    </svg>
  `)}`,

  // 3. Orbital Salvage Mech Pilot
  scifiMech: `data:image/svg+xml;utf8,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 450" width="100%" height="100%">
      <defs>
        <linearGradient id="hangarGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#0e1320"/>
          <stop offset="60%" stop-color="#141a2b"/>
          <stop offset="100%" stop-color="#0a0d17"/>
        </linearGradient>
        <linearGradient id="hazardYellow" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="#f59e0b"/>
          <stop offset="100%" stop-color="#fbbf24"/>
        </linearGradient>
        <linearGradient id="mechSteel" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#3b465e"/>
          <stop offset="50%" stop-color="#252d3f"/>
          <stop offset="100%" stop-color="#171c29"/>
        </linearGradient>
        <pattern id="hazardStripe" width="20" height="20" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="10" height="20" fill="#f59e0b"/>
          <rect x="10" width="10" height="20" fill="#171b29"/>
        </pattern>
      </defs>

      <!-- Hangar Interior Base -->
      <rect width="800" height="450" fill="url(#hangarGrad)"/>

      <!-- Deep Background Giant Bay Doors with Deep Space Starfield -->
      <rect x="220" y="30" width="360" height="260" fill="#05070e" rx="6" stroke="#252e42" stroke-width="2"/>
      <!-- Stars in space window -->
      <circle cx="280" cy="80" r="1" fill="#ffffff" opacity="0.8"/>
      <circle cx="340" cy="60" r="1.5" fill="#38bdf8"/>
      <circle cx="410" cy="110" r="1" fill="#ffffff" opacity="0.6"/>
      <circle cx="500" cy="70" r="1.2" fill="#ffffff"/>
      <circle cx="530" cy="130" r="1" fill="#38bdf8" opacity="0.7"/>
      <!-- Distant Earth/Planet Horizon Curve -->
      <path d="M220,240 Q400,200 580,240 L580,290 L220,290 Z" fill="#1e3a8a" opacity="0.5"/>
      <path d="M220,240 Q400,200 580,240" stroke="#38bdf8" stroke-width="2" fill="none" opacity="0.8"/>

      <!-- Overhead Gantry Crane Truss Structure -->
      <rect x="0" y="30" width="800" height="18" fill="#1d2436"/>
      <line x1="0" y1="48" x2="800" y2="48" stroke="#f59e0b" stroke-width="2"/>
      <line x1="80" y1="30" x2="140" y2="48" stroke="#374151" stroke-width="2"/>
      <line x1="140" y1="30" x2="200" y2="48" stroke="#374151" stroke-width="2"/>
      <line x1="600" y1="30" x2="660" y2="48" stroke="#374151" stroke-width="2"/>
      <line x1="660" y1="30" x2="720" y2="48" stroke="#374151" stroke-width="2"/>

      <!-- Industrial Floor Deck with Hazard Stripes -->
      <polygon points="0,320 800,320 800,450 0,450" fill="#131724"/>
      <rect x="0" y="320" width="800" height="8" fill="url(#hazardStripe)"/>

      <!-- Heavy Industrial Mech Silhouette (Center) -->
      <!-- Torso Core -->
      <polygon points="360,180 440,180 455,250 345,250" fill="url(#mechSteel)" stroke="#4b5563" stroke-width="1.5"/>
      <!-- Shoulder Armor Plates -->
      <polygon points="310,170 360,180 350,230 295,210" fill="#2d374d" stroke="#60a5fa" stroke-width="1"/>
      <polygon points="440,180 490,170 505,210 450,230" fill="#2d374d" stroke="#60a5fa" stroke-width="1"/>
      <!-- Glowing Blue Cockpit Visor Strip -->
      <polygon points="380,200 420,200 415,212 385,212" fill="#38bdf8" filter="drop-shadow(0 0 6px #38bdf8)"/>
      <!-- Heavy Bipedal Legs -->
      <polygon points="350,250 380,250 375,340 340,340" fill="#1e2536"/>
      <polygon points="420,250 450,250 460,340 425,340" fill="#1e2536"/>
      <!-- Hydraulic Feet on Deck -->
      <polygon points="325,340 385,340 395,365 320,365" fill="#2b344a"/>
      <polygon points="415,340 475,340 480,365 405,365" fill="#2b344a"/>

      <!-- Workstation Maintenance Gantry with Scaffolding -->
      <line x1="280" y1="180" x2="280" y2="340" stroke="#f59e0b" stroke-width="2.5"/>
      <line x1="260" y1="230" x2="310" y2="230" stroke="#f59e0b" stroke-width="2"/>
      <line x1="520" y1="180" x2="520" y2="340" stroke="#f59e0b" stroke-width="2.5"/>
      <line x1="490" y1="230" x2="540" y2="230" stroke="#f59e0b" stroke-width="2"/>

      <!-- Volumetric Hangar Floodlights -->
      <polygon points="120,48 40,380 220,380" fill="#38bdf8" opacity="0.08"/>
      <polygon points="680,48 580,380 760,380" fill="#38bdf8" opacity="0.08"/>

      <!-- Label Badge -->
      <rect x="20" y="20" width="155" height="22" rx="4" fill="#0d101a" opacity="0.85" stroke="#f59e0b" stroke-width="1"/>
      <text x="97" y="35" fill="#d7deed" font-family="'JetBrains Mono', monospace" font-size="10" font-weight="600" text-anchor="middle">ORBITAL HANGAR · MECH</text>
    </svg>
  `)}`,

  // 4. Tokyo Neon Kanji Signboard Cutout (Proper Cutout Asset)
  neonKanji: `data:image/svg+xml;utf8,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 450" width="100%" height="100%">
      <defs>
        <linearGradient id="neonBoxBg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#1a1c27"/>
          <stop offset="100%" stop-color="#0c0e17"/>
        </linearGradient>
        <filter id="kanjiGlow">
          <feGaussianBlur stdDeviation="4" result="blur"/>
          <feMerge>
            <feMergeNode in="blur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>

      <!-- Transparent Checkerboard Pattern Backdrop to show it's a CUTOUT -->
      <rect width="600" height="450" fill="#10131d"/>
      <g fill="#171b29" opacity="0.7">
        <rect x="0" y="0" width="25" height="25"/>
        <rect x="50" y="0" width="25" height="25"/>
        <rect x="25" y="25" width="25" height="25"/>
        <rect x="75" y="25" width="25" height="25"/>
      </g>

      <!-- Mounting Bracket Hardware (Left side) -->
      <rect x="180" y="80" width="50" height="14" fill="#38435d" rx="2"/>
      <circle cx="195" cy="87" r="3" fill="#64748b"/>
      <rect x="180" y="320" width="50" height="14" fill="#38435d" rx="2"/>
      <circle cx="195" cy="327" r="3" fill="#64748b"/>

      <!-- Vertical Lightbox Metal Housing -->
      <rect x="220" y="50" width="160" height="340" rx="8" fill="url(#neonBoxBg)" stroke="#38435d" stroke-width="3" filter="drop-shadow(0 15px 30px rgba(0,0,0,0.8))"/>
      <!-- Inner Frame Accent -->
      <rect x="230" y="60" width="140" height="320" rx="4" fill="#0f111a" stroke="#ff007f" stroke-width="1.5" stroke-dasharray="8,4" opacity="0.6"/>

      <!-- Glowing Japanese Kanji Characters: 電 (Den) 脳 (No) -->
      <g filter="url(#kanjiGlow)">
        <!-- Top Kanji: 電 (Cyber / Electric) in Hot Pink -->
        <text x="300" y="170" fill="#ff007f" font-family="'Noto Sans JP', 'Hiragino Sans', sans-serif" font-size="78" font-weight="900" text-anchor="middle">電</text>
        <text x="300" y="170" fill="#ffffff" font-family="'Noto Sans JP', 'Hiragino Sans', sans-serif" font-size="74" font-weight="900" text-anchor="middle" opacity="0.9">電</text>

        <!-- Bottom Kanji: 脳 (Brain) in Ice Cyan -->
        <text x="300" y="290" fill="#00f0ff" font-family="'Noto Sans JP', 'Hiragino Sans', sans-serif" font-size="78" font-weight="900" text-anchor="middle">脳</text>
        <text x="300" y="290" fill="#ffffff" font-family="'Noto Sans JP', 'Hiragino Sans', sans-serif" font-size="74" font-weight="900" text-anchor="middle" opacity="0.9">脳</text>

        <!-- Micro English subtitle -->
        <text x="300" y="345" fill="#38bdf8" font-family="'JetBrains Mono', monospace" font-size="12" font-weight="700" letter-spacing="4" text-anchor="middle">CYBERNETICS</text>
      </g>

      <!-- Glass Specular Reflection Highlight -->
      <polygon points="230,60 370,60 300,380 230,380" fill="#ffffff" opacity="0.04"/>

      <!-- Tag Indicator -->
      <rect x="20" y="20" width="130" height="22" rx="4" fill="#171b29" stroke="#6f00ff" stroke-width="1"/>
      <text x="85" y="35" fill="#d7deed" font-family="'JetBrains Mono', monospace" font-size="10" font-weight="600" text-anchor="middle">CUTOUT · ISOLATED</text>
    </svg>
  `)}`,

  // 5. Recon Quadcopter Drone Cutout
  reconDrone: `data:image/svg+xml;utf8,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 450" width="100%" height="100%">
      <defs>
        <linearGradient id="carbonBody" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#374151"/>
          <stop offset="50%" stop-color="#1f2937"/>
          <stop offset="100%" stop-color="#111827"/>
        </linearGradient>
      </defs>

      <rect width="600" height="450" fill="#10131d"/>

      <!-- Drone Propeller Rotors Blur Rings -->
      <!-- Top Left -->
      <ellipse cx="170" cy="130" rx="75" ry="18" fill="none" stroke="#38bdf8" stroke-width="2" opacity="0.4" stroke-dasharray="6,4"/>
      <!-- Top Right -->
      <ellipse cx="430" cy="130" rx="75" ry="18" fill="none" stroke="#38bdf8" stroke-width="2" opacity="0.4" stroke-dasharray="6,4"/>
      <!-- Bottom Left -->
      <ellipse cx="140" cy="280" rx="75" ry="18" fill="none" stroke="#38bdf8" stroke-width="2" opacity="0.4" stroke-dasharray="6,4"/>
      <!-- Bottom Right -->
      <ellipse cx="460" cy="280" rx="75" ry="18" fill="none" stroke="#38bdf8" stroke-width="2" opacity="0.4" stroke-dasharray="6,4"/>

      <!-- Carbon Fiber Arm Struts -->
      <line x1="300" y1="210" x2="170" y2="130" stroke="#1f2937" stroke-width="12" stroke-linecap="round"/>
      <line x1="300" y1="210" x2="430" y2="130" stroke="#1f2937" stroke-width="12" stroke-linecap="round"/>
      <line x1="300" y1="210" x2="140" y2="280" stroke="#1f2937" stroke-width="12" stroke-linecap="round"/>
      <line x1="300" y1="210" x2="460" y2="280" stroke="#1f2937" stroke-width="12" stroke-linecap="round"/>

      <!-- Motor Pods -->
      <circle cx="170" cy="130" r="14" fill="#374151" stroke="#60a5fa" stroke-width="2"/>
      <circle cx="430" cy="130" r="14" fill="#374151" stroke="#60a5fa" stroke-width="2"/>
      <circle cx="140" cy="280" r="14" fill="#374151" stroke="#60a5fa" stroke-width="2"/>
      <circle cx="460" cy="280" r="14" fill="#374151" stroke="#60a5fa" stroke-width="2"/>

      <!-- Central Fuselage Chassis -->
      <polygon points="260,170 340,170 365,230 300,265 235,230" fill="url(#carbonBody)" stroke="#4b5563" stroke-width="2" filter="drop-shadow(0 12px 24px rgba(0,0,0,0.7))"/>
      
      <!-- Sensor Turret Dome & Gimbal (Bottom) -->
      <circle cx="300" cy="245" r="24" fill="#0f172a" stroke="#38bdf8" stroke-width="2"/>
      <!-- Optical Camera Eye with Blue Specular Flare -->
      <circle cx="300" cy="245" r="12" fill="#0284c7"/>
      <circle cx="297" cy="242" r="4" fill="#ffffff"/>

      <!-- Status LED Indicators -->
      <circle cx="265" cy="180" r="3" fill="#10b981"/>
      <circle cx="335" cy="180" r="3" fill="#10b981"/>

      <!-- Label Badge -->
      <rect x="20" y="20" width="130" height="22" rx="4" fill="#171b29" stroke="#38bdf8" stroke-width="1"/>
      <text x="85" y="35" fill="#d7deed" font-family="'JetBrains Mono', monospace" font-size="10" font-weight="600" text-anchor="middle">DRONE PROP · 2K</text>
    </svg>
  `)}`,

  // 6. Wet Asphalt Rain Surface Texture
  wetAsphalt: `data:image/svg+xml;utf8,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 450" width="100%" height="100%">
      <defs>
        <linearGradient id="wetBase" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#141824"/>
          <stop offset="100%" stop-color="#0a0c13"/>
        </linearGradient>
        <radialGradient id="neonPuddlePink" cx="30%" cy="40%" r="40%">
          <stop offset="0%" stop-color="#ff007f" stop-opacity="0.45"/>
          <stop offset="60%" stop-color="#ff007f" stop-opacity="0.1"/>
          <stop offset="100%" stop-color="#0a0c13" stop-opacity="0"/>
        </radialGradient>
        <radialGradient id="neonPuddleCyan" cx="70%" cy="65%" r="45%">
          <stop offset="0%" stop-color="#00f0ff" stop-opacity="0.4"/>
          <stop offset="70%" stop-color="#00f0ff" stop-opacity="0.08"/>
          <stop offset="100%" stop-color="#0a0c13" stop-opacity="0"/>
        </radialGradient>
      </defs>

      <rect width="600" height="450" fill="url(#wetBase)"/>
      <rect width="600" height="450" fill="url(#neonPuddlePink)"/>
      <rect width="600" height="450" fill="url(#neonPuddleCyan)"/>

      <!-- Asphalt Grain & Micro-pebbles -->
      <g fill="#475569" opacity="0.4">
        <circle cx="80" cy="60" r="1.5"/><circle cx="140" cy="110" r="1"/><circle cx="210" cy="80" r="2"/><circle cx="280" cy="140" r="1.5"/>
        <circle cx="340" cy="90" r="1"/><circle cx="420" cy="120" r="2.5"/><circle cx="490" cy="70" r="1"/><circle cx="560" cy="130" r="1.8"/>
        <circle cx="90" cy="220" r="2"/><circle cx="170" cy="260" r="1.2"/><circle cx="230" cy="210" r="1.8"/><circle cx="310" cy="280" r="2.2"/>
        <circle cx="390" cy="240" r="1.5"/><circle cx="460" cy="290" r="1.8"/><circle cx="530" cy="230" r="2"/><circle cx="580" cy="270" r="1.2"/>
        <circle cx="60" cy="360" r="1.5"/><circle cx="130" cy="390" r="2"/><circle cx="220" cy="370" r="1.2"/><circle cx="300" cy="410" r="1.8"/>
        <circle cx="370" cy="360" r="2.2"/><circle cx="450" cy="390" r="1"/><circle cx="520" cy="370" r="1.8"/><circle cx="570" cy="420" r="2.5"/>
      </g>

      <!-- Rain Ripples in Puddles -->
      <ellipse cx="180" cy="170" rx="45" ry="12" fill="none" stroke="#ff007f" stroke-width="1.2" opacity="0.6"/>
      <ellipse cx="180" cy="170" rx="25" ry="7" fill="none" stroke="#ffffff" stroke-width="1" opacity="0.7"/>
      <ellipse cx="420" cy="290" rx="60" ry="15" fill="none" stroke="#00f0ff" stroke-width="1.2" opacity="0.6"/>
      <ellipse cx="420" cy="290" rx="30" ry="8" fill="none" stroke="#ffffff" stroke-width="1" opacity="0.7"/>

      <!-- Label Badge -->
      <rect x="20" y="20" width="140" height="22" rx="4" fill="#0d101a" opacity="0.85" stroke="#38bdf8" stroke-width="1"/>
      <text x="90" y="35" fill="#d7deed" font-family="'JetBrains Mono', monospace" font-size="10" font-weight="600" text-anchor="middle">TEXTURE · SEAMLESS</text>
    </svg>
  `)}`,

  // 7. Industrial Rusted Scaffolding Texture
  rustedMetal: `data:image/svg+xml;utf8,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 450" width="100%" height="100%">
      <defs>
        <linearGradient id="metalPlate" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#2a3242"/>
          <stop offset="50%" stop-color="#1e2430"/>
          <stop offset="100%" stop-color="#141822"/>
        </linearGradient>
        <radialGradient id="rustSpread" cx="40%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#9a3412" stop-opacity="0.8"/>
          <stop offset="50%" stop-color="#c2410c" stop-opacity="0.4"/>
          <stop offset="100%" stop-color="#1e2430" stop-opacity="0"/>
        </radialGradient>
      </defs>

      <rect width="600" height="450" fill="url(#metalPlate)"/>
      <rect width="600" height="450" fill="url(#rustSpread)"/>

      <!-- Steel Seam Joint Lines -->
      <line x1="0" y1="225" x2="600" y2="225" stroke="#0f131a" stroke-width="3"/>
      <line x1="300" y1="0" x2="300" y2="450" stroke="#0f131a" stroke-width="3"/>

      <!-- Hexagonal Heavy Rivets -->
      <g fill="#374151" stroke="#111827" stroke-width="1.5">
        <circle cx="30" cy="30" r="7"/><circle cx="270" cy="30" r="7"/><circle cx="330" cy="30" r="7"/><circle cx="570" cy="30" r="7"/>
        <circle cx="30" cy="195" r="7"/><circle cx="270" cy="195" r="7"/><circle cx="330" cy="195" r="7"/><circle cx="570" cy="195" r="7"/>
        <circle cx="30" cy="255" r="7"/><circle cx="270" cy="255" r="7"/><circle cx="330" cy="255" r="7"/><circle cx="570" cy="255" r="7"/>
        <circle cx="30" cy="420" r="7"/><circle cx="270" cy="420" r="7"/><circle cx="330" cy="420" r="7"/><circle cx="570" cy="420" r="7"/>
      </g>

      <!-- Rust Corrosion Patches -->
      <path d="M220,120 Q260,90 290,140 T340,210 T250,230 Z" fill="#7c2d12" opacity="0.65"/>
      <path d="M240,140 Q270,120 290,160 T310,190 Z" fill="#ea580c" opacity="0.45"/>

      <!-- Scratches & Mill Marks -->
      <line x1="80" y1="110" x2="160" y2="90" stroke="#94a3b8" stroke-width="0.8" opacity="0.4"/>
      <line x1="400" y1="320" x2="480" y2="360" stroke="#94a3b8" stroke-width="0.8" opacity="0.4"/>

      <!-- Label Badge -->
      <rect x="20" y="20" width="140" height="22" rx="4" fill="#0d101a" opacity="0.85" stroke="#f59e0b" stroke-width="1"/>
      <text x="90" y="35" fill="#d7deed" font-family="'JetBrains Mono', monospace" font-size="10" font-weight="600" text-anchor="middle">TEXTURE · RUST PLATE</text>
    </svg>
  `)}`,

  // 8. Impressionist Oil Impasto Palette (Reference Style)
  oilPalette: `data:image/svg+xml;utf8,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 450" width="100%" height="100%">
      <defs>
        <linearGradient id="woodPalette" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#3e2723"/>
          <stop offset="50%" stop-color="#2d1b15"/>
          <stop offset="100%" stop-color="#1a0f0c"/>
        </linearGradient>
      </defs>

      <rect width="600" height="450" fill="#10131d"/>

      <!-- Wooden Oval Artist Palette -->
      <path d="M60,225 C60,110 180,50 320,50 C460,50 540,130 540,240 C540,350 440,400 300,400 C180,400 60,340 60,225 Z" fill="url(#woodPalette)" stroke="#4e342e" stroke-width="3" filter="drop-shadow(0 15px 30px rgba(0,0,0,0.8))"/>

      <!-- Thick Textured Impasto Swatches -->
      <!-- Titanium White Swatch -->
      <path d="M120,160 Q170,120 220,150 Q180,190 130,180 Z" fill="#f8fafc" filter="drop-shadow(2px 4px 6px rgba(0,0,0,0.5))"/>
      <!-- Cadmium Crimson Swatch -->
      <path d="M220,110 Q270,90 310,130 Q270,160 230,130 Z" fill="#dc2626" filter="drop-shadow(2px 4px 6px rgba(0,0,0,0.5))"/>
      <!-- Ochre Yellow Swatch -->
      <path d="M320,100 Q380,85 410,125 Q370,155 330,120 Z" fill="#d97706" filter="drop-shadow(2px 4px 6px rgba(0,0,0,0.5))"/>
      <!-- Ultramarine Deep Swatch -->
      <path d="M410,140 Q470,140 480,190 Q430,220 400,170 Z" fill="#1d4ed8" filter="drop-shadow(2px 4px 6px rgba(0,0,0,0.5))"/>
      <!-- Viridian Green Swatch -->
      <path d="M420,230 Q480,260 460,310 Q400,310 410,250 Z" fill="#047857" filter="drop-shadow(2px 4px 6px rgba(0,0,0,0.5))"/>
      <!-- Burnt Umber Knife Drag -->
      <path d="M280,240 Q340,230 360,270 Q300,290 260,260 Z" fill="#78350f" filter="drop-shadow(2px 4px 6px rgba(0,0,0,0.5))"/>

      <!-- Label Badge -->
      <rect x="20" y="20" width="145" height="22" rx="4" fill="#171b29" stroke="#6f00ff" stroke-width="1"/>
      <text x="92" y="35" fill="#d7deed" font-family="'JetBrains Mono', monospace" font-size="10" font-weight="600" text-anchor="middle">STYLE REFERENCE · OIL</text>
    </svg>
  `)}`,
};
