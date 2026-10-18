# ARCHITECTURE.md v2.0 — AristoColors Studio

> **Version:** 2.0.0  
> **Target System:** AristoColors Studio  
> **Status:** Architecture Specification (Zero-Based Rebuild)  
> **Primary Rule:** The Application Shell is the first implementation priority. No editor tool or harmonization feature may be implemented prior to shell completion and sign-off.

---

## 1. Product Vision & Architectural Principles

### 1.1 Product Vision
**AristoColors Studio** is a high-performance web-based photobashing suite and style harmonization engine designed for concept artists, matte painters, visual development artists, and creative directors. 

Traditional photobashing is bottlenecked by manual color balancing, edge blending, shadow matching, and texture reconciliation across heterogeneous photo elements. AristoColors Studio unifies non-destructive layer compositing with a dual-mode harmonization engine (**Manual Parametric** + **AI Neural Engine**), enabling artists to blend cutouts into target aesthetics—whether photorealistic, anime, oil painting, retro comic, or cyberpunk—without loss of identity or compositional intent.

### 1.2 Core Architectural Principles
1. **Shell-First Architecture:** The application runtime shell (navigation, project management, state persistence, layout orchestration, design system tokens) is autonomous and decoupled from the graphics engine.
2. **Deterministic Non-Destructive Pipeline:** All layer modifications, masks, transforms, adjustments, and harmonization operations are recorded as parametric transformations over immutable raw asset buffers. Original source assets are never permanently mutated.
3. **Dual Harmonization Parity:** Harmonization is never purely a "black box prompt". Artists retain granular parametric control (histogram matching, light direction, color temperature, ambient occlusion) with the option to engage the neural engine (Gemini vision/image transformation models) for complex multi-factor synthesis.
4. **Zero Aesthetic Bias (Style-Agnostic):** The engine does not assume photorealism is the ultimate goal. A painterly background compels painterly harmonization; a stylized anime cell compels cel-shaded lighting and edge quantization.
5. **Single Source of Truth (SSOT) Document Model:** The document state is an immutable tree representing layers, masks, blending modes, and metadata. Viewport state (zoom, pan, active tool, selection polygons) is strictly separated from document state.
6. **Strict Clean Architecture & Interface Segregation:** UI components never directly invoke canvas contexts or raw API endpoints. They emit commands via unified action dispatchers to domain services.
7. **Production Modularity for Incremental Builds:** Every component, service, and domain module must be completely self-contained within single, cohesive files suitable for isolated implementation, verification, and manual synchronization.

---

## 2. Application Shell Architecture

The Application Shell provides the persistent operational scaffolding for the user across all modes of operation. It encapsulates window boundaries, command dispatching, global alerts, project metadata, and top-level navigation.

```
+------------------------------------------------------------------------------------+
|                                GLOBAL APPLICATION HEADER                           |
| [Brand / Project Name]  [Breadcrumbs]  [Undo/Redo]  [Save/Cloud]  [Export] [User]  |
+---------+--------------------------------------------------------------------------+
|         |                                                                          |
| GLOBAL  |                           ACTIVE ROUTE VIEWPORT                          |
| PRIMARY |                                                                          |
| SIDEBAR |  - Projects Hub (/projects)                                              |
|         |  - Studio Editor Workspace (/studio/:id)                                 |
| - Proj  |  - Assets Library (/assets)                                              |
| - Assets|  - AI Generations Log (/generations)                                     |
| - Gener |  - Studio Settings (/settings)                                           |
| - Sett  |  - Plan & Billing (/billing) [WayForPay]                                 |
| - Help  |                                                                          |
+---------+--------------------------------------------------------------------------+
|                       GLOBAL STATUS BAR / RECOVERY BANNER                          |
+------------------------------------------------------------------------------------+
```

### 2.1 Shell Components & Layout Roles
- **Global Header (`AppHeader`):**
  - Project Title & Status Badge (`Draft`, `Saved`, `Syncing`, `Offline`).
  - History controllers (`Undo [Ctrl+Z]`, `Redo [Ctrl+Shift+Z]`).
  - View controls (Zoom level dropdown, Grid snapping toggle, View reset).
  - Primary context action: `Export Canvas` or `Save to Cloud`.
  - Account & Workspace dropdown.
- **Global Primary Sidebar (`AppSidebar`):**
  - Collapsible (64px icon-only rail to 240px expanded navigation drawer).
  - Navigation links:
    - **Projects Hub** (All documents, recents, templates).
    - **Assets Library** (Textures, brushes, cutouts, reference boards).
    - **Generations Log** (History of AI harmonization batches and seeds).
    - **Settings** (Keybindings, color profiles, scratch disk, display limits).
    - **Billing & Subscription** (WayForPay checkout, tier limits, invoice receipts).
  - Collapse toggle with persistence in `localStorage`.
- **Active Route Viewport (`ShellContent`):**
  - Isolated container utilizing CSS Grid / Flexbox for zero-scroll viewport lock (`overflow: hidden; height: 100vh`).
- **Global Command Palette & Keyboard Manager (`CommandPalette`):**
  - Modal triggered via `Ctrl+K` / `Cmd+K`.
  - Instant search across tools, layers, recent projects, and export actions.
- **Notification & Feedback Layer (`ToastProvider` & `StatusBar`):**
  - Transient notifications (success, warning, error, async task progress).
  - Non-blocking bottom status bar showing cursor coordinates, canvas dimensions, color picker hex preview, and memory usage.

### 2.2 Lifecycle & State Invariants in Shell
1. **Zero Layout Shift:** Header, sidebar, and toolbars occupy fixed flex slots; canvas container dynamically calculates remaining client rect via `ResizeObserver`.
2. **Graceful Hydration & Persistence:** Application Shell immediately restores layout preferences (sidebar collapse state, theme, panel dimensions) without flickering.
3. **Unsaved Changes Shield:** Window-level `beforeunload` listener triggered if project dirty flag is true.

---

## 3. Page Hierarchy & Navigation

The application employs clean client-side routing with deep linkable project IDs and state synchronization.

```
/
├── /projects                     -> Projects Hub (Dashboard, Grid/List, New Project Modal)
├── /studio/:projectId            -> Professional Studio Workspace (Editor core)
│     ├── ?tool=select|brush|...  -> Contextual tool selection
│     └── ?tab=layers|harmonize   -> Active inspector panel
├── /assets                       -> Assets Library (Asset packs, tags, upload, preview)
├── /generations                  -> Generations History & Audit Trail (Prompts, seeds, diffs)
├── /settings                     -> Preferences (System, shortcuts, API keys, color management)
└── /billing                      -> Account Subscription & Invoices (WayForPay integration)
```

### 3.1 Route Breakdown & Responsibilities

| Route | Primary Responsibilities | Empty State | Error / Recovery State |
| :--- | :--- | :--- | :--- |
| `/projects` | Project cards, filter by tag, duplicate, delete, import `.aristo` file, export bundle. | "No projects found. Create your first canvas or import an existing `.aristo` file." | Corrupted project card flag; restore from local IndexedDB snapshot. |
| `/studio/:projectId` | High-fidelity canvas, layers, photobashing tools, harmonization engine. | Document canvas initialized with configured dimension presets (e.g. 4K, 1440p, Concept Art 16:9). | WebGL context lost recovery banner; reload from autosave buffer. |
| `/assets` | Categorized repository of foreground cutouts, atmospheric overlays, reference styles, textures. | "Your asset library is empty. Drag and drop PNG, JPEG, WEBP or SVG elements." | Failed upload retry queue; corrupted asset indicator. |
| `/generations` | Gallery of all AI Harmonize runs with seed parameters, before/after sliders, and one-click "Apply as New Layer". | "No AI harmonizations executed yet." | Failed generation task retry with detailed error message. |
| `/settings` | Scratchpad memory allocation, Gemini API key toggle (Custom vs Workspace Managed), keymap rebindings. | Default settings loaded. | Settings reset to defaults button. |
| `/billing` | Current tier overview, compute credits balance, WayForPay checkout widget, transaction history. | Free starter plan active badge. | Payment gateway unreachable alert; retry payment modal. |

---

## 4. Unified Design System

The design system enforces a sleek, dark-mode-first aesthetic optimized for high color-accuracy and minimal visual fatigue during multi-hour painting and compositing sessions.

### 4.1 Foundations & Tokens

```css
/* Color Tokens (Slate / Charcoal / Zinc Base with Electric Violet Accent) */
--surface-bg:         #0a0b0e; /* Deep canvas backdrop */
--surface-panel:      #12141a; /* Toolbars, inspectors, headers */
--surface-elevated:   #191c24; /* Popovers, modals, tooltips */
--surface-hover:      #232733; /* Interactive hover states */
--surface-active:     #2c3242; /* Selected layers, pressed buttons */

--border-subtle:      #1f2430; /* Divider lines, structural borders */
--border-strong:      #2e3648; /* Focused inputs, active panel borders */
--border-focus:       #6366f1; /* Primary focus ring */

--text-primary:       #f3f4f6; /* Headings, primary labels, values */
--text-secondary:     #9ca3af; /* Secondary descriptions, tool shortcuts */
--text-muted:         #6b7280; /* Disabled states, placeholders */

--accent-primary:     #6366f1; /* Indigo/Violet accent (Buttons, sliders) */
--accent-primary-hover:#4f46e5;
--accent-cyan:        #06b6d4; /* Harmonize active mode highlight */
--accent-amber:       #f59e0b; /* Warnings, non-destructive flags */
--accent-emerald:     #10b981; /* Success, cloud synced */
--accent-rose:        #f43f5e; /* Destructive, mask erase */
```

### 4.2 Typography
- **UI Font:** `Inter`, `-apple-system`, `BlinkMacSystemFont`, `Segoe UI`, sans-serif.
- **Monospace Font (Coordinates, Hex, Dimensions):** `JetBrains Mono`, `Fira Code`, monospace.
- **Hierarchy:**
  - `Display / Modal Titles:` 18px (Font-weight: 600, tracking: -0.01em)
  - `Panel Headers / Section Titles:` 13px (Font-weight: 600, uppercase, tracking: 0.05em, text-secondary)
  - `Body / Labels:` 12px (Font-weight: 400 & 500)
  - `Micro / Tooltips / Hotkeys:` 10px / 11px (Font-weight: 500, tabular-nums)

### 4.3 Component Specs & Interaction States
1. **Buttons (`UIButton`):**
   - *Primary:* Accent background, white text, subtle hover lift, ring on focus.
   - *Secondary:* `surface-elevated` background, subtle border, `text-primary`.
   - *Ghost / Icon:* Transparent background, `surface-hover` on hover, active state inset.
   - *Destructive:* Rose background or red outline with clear confirmation modal for project/layer deletion.
2. **Numerical Inputs & Scrubbable Sliders (`UIScrubberInput`):**
   - Click-to-type or drag horizontally on label to adjust numeric values (e.g. Opacity, Feather Radius, Harmonize Intensity).
   - Minimum, maximum, and step clamping with soft bounce animation.
3. **Inspector Tabs & Accordions (`UIPanelSection`):**
   - Collapsible with chevron indicator, header state persistence.
   - Integrated visibility toggles on section headers (e.g. toggle whole effect pass on/off).
4. **Modal Dialogs & Floating Drawers (`UIModal`):**
   - Centered backdrop with `backdrop-filter: blur(8px)`.
   - Trapped keyboard focus (`Esc` closes, `Enter` confirms primary).

---

## 5. Studio Workspace Structure

The `/studio/:projectId` route loads the full multi-pane workspace layout.

```
+--------------------------------------------------------------------------------------------------+
| WORKSPACE SUB-HEADER: Project Title | Preset Info | Undo/Redo | Zoom 100% | View Options | Export|
+------------+-------------------------------------------------------------+-----------------------+
| TOOLBAR    |                       CENTRAL CANVAS                        | INSPECTOR DOCK        |
| (48px)     |                                                             | (320px)               |
|            |  +-------------------------------------------------------+  |                       |
| [Pointer]  |  | [Active Tool Context Bar (Feather, Blend, Tolerance)] |  | [TABS: Layers | Style |
| [Marquee]  |  +-------------------------------------------------------+  |        Harmonize | FX]|
| [Lasso]    |  |                                                       |  |                       |
| [Transform]|  |                       DOCUMENT                        |  | --- LAYERS STACK ---  |
| [Brush]    |  |                       VIEWPORT                        |  | [Add Layer] [Group]   |
| [Eraser]   |  |                  (Interactive Canvas                  |  | [Mask] [Delete]       |
| [Clone]    |  |                    Pan / Zoom / Grid)                 |  |                       |
| [Harmonize]|  |                                                       |  | [L3: Foreground Hero] |
| [Inpaint]  |  |                                                       |  | [L2: Atmosphere FX]  |
| [Eyedrop]  |  |                                                       |  | [L1: Base Background] |
| [Hand/Pan] |  |                                                       |  |                       |
|            |  +-------------------------------------------------------+  | --- LAYER DETAILS --- |
| [Color A/B]|  | Bottom Quick Bar: Cursor (X,Y) | Color | Memory | Safe|  | Blending / Opacity    |
+------------+-------------------------------------------------------------+-----------------------+
```

### 5.1 Left Toolbar (Tool Palette)
- **Selection Group:** 
  - Rectangular Marquee (`M`), Elliptical Marquee (`Shift+M`).
  - Polygon Lasso (`L`), Magnetic Lasso, Freehand Lasso.
- **Composition Group:**
  - Layer Move & Transform Gizmo (`V`) (Uniform scale, free distort, pivot point).
  - Slice & Crop Tool (`C`).
- **Painting & Masking Group:**
  - Soft/Hard Brush (`B`) (Size, hardness, flow, smoothing).
  - Eraser (`E`) (Direct pixel or Mask Eraser).
  - Clone Stamp / Healing Brush (`S`) (Sample point with `Alt+Click`).
- **Harmonization & Neural Group:**
  - Style Harmonizer Picker (`H`) (Target layer vs reference style source).
  - Generative Inpainter (`I`) (Quick-brush lasso mask for generative fill).
- **Navigation & Sampling:**
  - Eyedropper (`I`) (Current layer vs all layers composite sample).
  - Hand / Pan Tool (`H` or `Spacebar + Drag`).
  - Zoom Tool (`Z` or `Alt + Mouse Wheel`).
- **Color Swatches:**
  - Primary Foreground & Secondary Background swatches with Swap (`X`) and Reset Default Black/White (`D`).

### 5.2 Central Canvas Viewport
- **Infinite Stage with Constrained Canvas:** Document bounds are explicitly framed with an outer stage drop shadow and ruler guides.
- **Top Context Bar (`ToolContextBar`):** Dynamically updates based on the selected tool (e.g. for Lasso: Feather input, Antialias toggle, Add/Subtract/Intersect selection modes).
- **Overlay HUD:**
  - Transform bounding box with rotation handles, scale anchors, and angle readout.
  - Selection march (animated "marching ants" dash pattern computed via WebGL or 2D canvas path).
  - Brush cursor silhouette dynamically scaling with zoom and brush radius.

### 5.3 Right Inspector Dock
Tabbed dockable container with customizable panels:
1. **Layers Panel:** Tree of layers and groups, visibility eye, lock toggle, clipping mask indicators, thumbnail previews, opacity slider, blend mode dropdown.
2. **Properties Panel:** Transform coordinates (`X, Y, W, H, Rotation, Flip`), color profile, smart filters.
3. **AristoColors Harmonize Panel:** Dedicated workspace for live manual and AI harmonization.
4. **History Panel:** Linear undo stack with step snapshots and jump-to-state capability.

---

## 6. Photobashing Editor Architecture

The editor engine is engineered for low latency (60 FPS interaction) and high-resolution compositing (up to 8K documents).

```
                      +-----------------------------+
                      |       USER INPUT EVENT      |
                      |  (Mouse / Stylus / Keys)    |
                      +--------------+--------------+
                                     |
                                     v
                      +-----------------------------+
                      |      TOOL EVENT ROUTER      |
                      |  Translates to Tool Action  |
                      +--------------+--------------+
                                     |
         +---------------------------+---------------------------+
         |                                                       |
         v                                                       v
+-------------------------------+               +-------------------------------+
|      DOCUMENT COMMAND BUS     |               |    INTERACTION OVERLAY RENDER |
| (Immutable state transitions) |               |  (Marching ants, brush ring,  |
| - LayerAdd / LayerTransform   |               |   transform gizmo at 60 FPS)  |
| - MaskPaint / PixelCutCopy    |               +-------------------------------+
+---------------+---------------+
                |
                v
+-------------------------------+
|   SCENE GRAPH & COMPOSITOR    |
| - Layer 1 (Base BG)           |
| - Layer 2 (Group / Clip Mask) |
| - Layer 3 (Hero Cutout)       |
+---------------+---------------+
                |
                v
+-------------------------------+
|    OFFSCREEN TILE COMPOSITOR  |
|  WebGL2 / Canvas2D Pipeline   |
| - Blending modes              |
| - Adjustment shaders          |
| - Rasterized view buffers     |
+---------------+---------------+
                |
                v
+-------------------------------+
|    ON-SCREEN VIEWPORT BLIT    |
+-------------------------------+
```

### 6.1 Layer Model & Data Structures

```typescript
export type BlendMode =
  | 'normal'
  | 'multiply'
  | 'screen'
  | 'overlay'
  | 'darken'
  | 'lighten'
  | 'color-dodge'
  | 'color-burn'
  | 'hard-light'
  | 'soft-light'
  | 'difference'
  | 'exclusion'
  | 'hue'
  | 'saturation'
  | 'color'
  | 'luminosity';

export interface Transform2D {
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  rotation: number; // degrees
  skewX: number;
  skewY: number;
  originX: number; // 0.0 to 1.0 (pivot)
  originY: number;
}

export interface LayerMask {
  id: string;
  width: number;
  height: number;
  buffer: ImageData | ImageBitmap;
  isEnabled: boolean;
  isLinked: boolean; // linked to layer transform
  isClamping: boolean;
}

export type LayerType = 'raster' | 'group' | 'adjustment' | 'harmonized_clone';

export interface LayerNode {
  id: string;
  parentId: string | null;
  name: string;
  type: LayerType;
  visible: boolean;
  locked: boolean;
  opacity: number; // 0.0 to 1.0
  blendMode: BlendMode;
  transform: Transform2D;
  mask: LayerMask | null;
  
  // Raster-specific buffer (OffscreenCanvas/ImageBitmap)
  pixelBuffer?: ImageBitmap | HTMLCanvasElement;
  sourceAssetId?: string; // Reference to original asset in library
  
  // Non-destructive adjustments
  adjustments?: LayerAdjustments;
  
  // Children if group
  childrenIds?: string[];
}

export interface LayerAdjustments {
  brightness: number;  // -100 to 100
  contrast: number;    // -100 to 100
  saturation: number;  // -100 to 100
  hue: number;         // -180 to 180
  temperature: number; // -100 (cool) to +100 (warm)
  tint: number;        // -100 (green) to +100 (magenta)
  levels: {
    blackIn: number;
    whiteIn: number;
    gamma: number;
  };
}

export interface ProjectDocument {
  id: string;
  name: string;
  width: number;
  height: number;
  dpi: number;
  colorSpace: 'srgb' | 'display-p3';
  createdAt: number;
  updatedAt: number;
  rootLayerIds: string[];
  layers: Record<string, LayerNode>;
  activeLayerId: string;
  selection: SelectionState | null;
}
```

### 6.2 Selection Architecture: Lasso, Rectangle, Feather
1. **Selection Representation:**
   - Vector Contour: Polygon points array for crisp editing and serialization.
   - Raster Alpha Mask (8-bit grayscale bitmap matching document resolution): Used for pixel operations, feathering, and cut/copy/paste.
2. **Feathering Algorithm:**
   - Multi-pass separable Gaussian blur or fast Box-Blur approximation executed on the 8-bit selection alpha mask.
3. **Cut / Copy / Paste Workflow:**
   - **Copy (`Ctrl+C`):** Extracts intersecting pixels from the currently active raster layer under the selection alpha mask into a detached `ClipboardFragment`.
   - **Cut (`Ctrl+X`):** Copies fragment to clipboard, then clears those pixels from the active layer buffer (or writes 0 to mask if non-destructive mode is selected).
   - **Paste (`Ctrl+V`):** Creates a new `LayerNode` (`type: 'raster'`) containing the clipped fragment positioned at the selection center, automatically activating the Transform gizmo.

### 6.3 Layer Masks, Brushes, Eraser & Inpainting
- **Non-Destructive Masking:** Editing a mask redirects brush/eraser writes to the layer's 1-channel alpha buffer without touching the RGB pixel data.
- **Brush Engine:**
  - Interpolated distance stamping (Bresenham / cubic spline interpolation between mouse move events) prevents bead gaps during rapid stylus strokes.
  - Brush tip dynamics: Size jitter, opacity flow, soft edge falloff via radial gradient lookup table.
- **Clone Stamp / Healing:**
  - Dual-coordinate tracking: Reference origin `(Sx, Sy)` and Target destination `(Tx, Ty)`.
  - On stroke, extracts source patch, aligns position vector, and composites onto target layer. Healing brush adds Poisson blending / seamless cloning to match surrounding illumination.
- **Inpainting (Generative Fill):**
  - Artist draws mask over undesired artifact or gap.
  - Engine bundles source image + binary mask + context prompt to the backend AI service.
  - Result is returned as an independent `Inpaint Patch Layer` seamlessly aligned to the bounding box.

### 6.4 History, Undo/Redo & Project Persistence
- **Command Pattern with Delta Buffers:**
  - Actions implement `execute()` and `undo()`.
  - For pixel alterations (brush strokes), only the bounding-box dirty rectangle of the modified canvas tile is preserved in the history stack, preventing runaway memory consumption.
- **History Limits:** Default 50 undo steps; snapshotting to IndexedDB ensures recovery after browser reload or memory eviction.
- **Persistence:** Document schema is serialized into a lightweight JSON project manifest, while binary layer bitmaps are indexed in browser IndexedDB (or serialized as PNG blobs in `.aristo` zip archives).

---

## 7. AristoColors Engine Architecture

The AristoColors Engine solves the core photobashing challenge: seamlessly integrating imported fragments (subject, prop, vehicle, landscape) into a destination scene's distinct visual style, lighting, and palette.

```
+-------------------------------------------------------------------------------------------------+
|                                     ARISTOCOLORS ENGINE                                         |
+-------------------------------------------------------------------------------------------------+
|                                                                                                 |
|   +-----------------------+   +-----------------------+   +---------------------------------+   |
|   |   SOURCE FRAGMENT     |   |     STYLE TARGET      |   |       HARMONIZE PROFILE         |   |
|   |  - Active Layer Cutout|   |  - Background Layer   |   |  - Mode: Manual vs AI Neural    |   |
|   |  - Mask & Alpha       |   |  - Reference Image    |   |  - Target Style: (Realistic,    |   |
|   |                       |   |  - Preset Art Style   |   |    Anime, Oil, Cyberpunk, etc.) |   |
|   +-----------+-----------+   +-----------+-----------+   +----------------+----------------+   |
|               |                           |                                |                    |
|               +---------------------+     |     +--------------------------+                    |
|                                     |     |     |                                               |
|                                     v     v     v                                               |
|               +-------------------------------------------------------+                         |
|               |              HARMONIZE ORCHESTRATOR                   |                         |
|               |  1. Color & Palette Transfer (Histograms / LUT)       |                         |
|               |  2. Illumination & Shadow Matching (Direction & AO)  |                         |
|               |  3. Edge & Contact Reconciliation (Feather/Wrap/Bleed)|                         |
|               |  4. Texture & Grain Synthesis                         |                         |
|               |  5. AI Multi-Modal Refinement (Gemini Vision/Image)   |                         |
|               +---------------------------+---------------------------+                         |
|                                           |                                                     |
|                                           v                                                     |
|               +-------------------------------------------------------+                         |
|               |               NON-DESTRUCTIVE OUTPUT                  |                         |
|               |  - New Harmonized Variant Layer                       |                         |
|               |  - Live Before/After Comparison Split Slider          |                         |
|               |  - Blend Factor & Identity Preservation Slider        |                         |
|               +-------------------------------------------------------+                         |
+-------------------------------------------------------------------------------------------------+
```

### 7.1 Three Style Sources
1. **Background Image (Contextual Ambient):**
   - Extracts dominant light vectors, color temperature, atmospheric haze, and ambient shadows from the underlying background layer.
2. **Reference Image (External Style Target):**
   - The user supplies an external reference piece (e.g. a master painting by Sargent, a frame from an anime feature, a photo from a brutalist film). The engine samples its color palette, contrast ratios, and stroke characteristics.
3. **Artistic Style Presets:**
   - Built-in curated style matrices:
     - *Cinematic Film Noir* (High contrast, hard key lights, cold tones, grain).
     - *Concept Art Matte Painting* (Atmospheric depth, aerial perspective, soft rim light).
     - *Classic Oil Painting* (Impasto edges, warm underpainting, chiaroscuro).
     - *Anime / Cel-Shaded* (Edge ink-lines, 2-tone stepped shading, vibrant saturation).
     - *Retro Comic Book* (Halftone dots, CMYK plate registration, print bleed).
     - *Cyberpunk Neo-Dusk* (Bichromatic magenta/cyan backlight, bloom, neon reflections).

### 7.2 Dual-Mode Engine: Manual vs AI Neural

#### Mode A: Manual Parametric Harmonize (Instant 60 FPS Client-Side)
- **Color Grading & Histogram Matching:** Reinhard color transfer or Monge-Kantorovitch color alignment in CIELAB color space. Transfers mean and standard deviation from target style to source fragment while preserving luminance structure.
- **Light Wrapping (Edge Light Bleed):** Convolves the background behind the subject edge and blends it inward along the cutout silhouette with adjustable radius (1px - 20px) and opacity.
- **Atmospheric Perspective:** Depth-based haze wash matching the background's vanishing point tint.
- **Contact Shadow Synthesizer:** Parametric ambient occlusion generator projecting grounded contact shadows beneath the bottom silhouette of the subject.

#### Mode B: AI Neural Harmonize (Gemini Image Transformation Pipeline)
- Utilizes Google Gemini multi-modal models (`imagen-3.0-generate-002` or `gemini-2.5-flash` image editing endpoints) with structured system constraints.
- **Composition & Identity Invariance:**
  - Bounding box and contour masks are enforced.
  - The model prompt is constructed deterministically with negative guidance forbidding changes to pose, silhouette shape, or key anatomical facial features.
- **Style Injection:**
  - The reference style or background slice is passed alongside the cutout in a multi-image conditioning payload.
  - Instruction prompt specifies the target medium (e.g. *"Re-render the lighting, surface materials, and brushwork of Image A so it seamlessly matches the artistic style, light angle, and textural medium of Image B. Do not alter the subject's anatomy or silhouette."*).

### 7.3 Before/After Comparison & Acceptance
- **Split-Screen Viewer:** Interactive draggable curtain dividing original cutout and harmonized result.
- **Difference Heatmap:** Visualizes luminance and chromatic shift across the subject.
- **Commit Options:**
  - *Apply in Place:* Replaces current layer with undo snapshot.
  - *Apply as New Layer:* Creates `Harmonized_Copy` above original, preserving raw cutout for AB testing.
  - *Blend with Original:* Dynamic opacity interpolation slider.

---

## 8. State Management & Data Flow

The studio architecture enforces unidirectional data flow using modern reactive state stores (e.g. Zustand with immutable updates).

```
                                +-------------------+
                                |    USER INTENT    |
                                +---------+---------+
                                          |
                                          v
                                +-------------------+
                                | ACTION DISPATCHER |
                                +---------+---------+
                                          |
                     +--------------------+--------------------+
                     |                                         |
                     v                                         v
         +-----------------------+                 +-----------------------+
         |     DOCUMENT STORE    |                 |    WORKSPACE STORE    |
         |  (Persistent state)   |                 |   (Ephemeral state)   |
         |  - Layer tree         |                 |  - Active tool        |
         |  - Mask descriptors   |                 |  - Zoom / Pan offset  |
         |  - Project metadata   |                 |  - Selection paths    |
         |  - History stacks     |                 |  - Modal visibility   |
         +-----------+-----------+                 +-----------+-----------+
                     |                                         |
                     +--------------------+--------------------+
                                          |
                                          v
                               +--------------------+
                               | REACTIVE OBSERVERS |
                               +----------+---------+
                                          |
                     +--------------------+--------------------+
                     |                                         |
                     v                                         v
         +-----------------------+                 +-----------------------+
         |  REACT UI COMPONENTS  |                 | COMPOSITOR / ENGINE   |
         |  (Panels, Tree, HUD)  |                 | (Canvas Viewport)     |
         +-----------------------+                 +-----------------------+
```

### 8.1 The User Journey & Flow
```
Projects Hub 
  ├── Create New Canvas / Open Existing
  v
Studio Workspace 
  ├── Import Assets (Background, Subject Photos, Textures)
  v
Compose & Arrange 
  ├── Transform, Cut/Copy fragments, Arrange Z-order, Set masks
  v
Harmonize (AristoColors Engine)
  ├── Select source layer + Select target style (BG / Ref / Preset)
  ├── Adjust Manual parameters (Light wrap, color match, AO)
  └── [Optional] Run AI Neural Harmonize for complex material synthesis
  v
Finish & Polish
  ├── Clone stamp seams, dodge/burn highlights, add atmospheric haze
  v
Export
  └── High-Res PNG, JPEG, WEBP, or full layered .aristo project
```

### 8.2 Separation of Concerns
1. **Document Store:** Contains serializable, non-ephemeral project data. Every action here increments history undo buffers and triggers autosave to IndexedDB.
2. **Workspace Store:** Contains viewport zoom (`scale: 1.0`), translation coordinates (`panX, panY`), active tool (`activeTool: 'lasso'`), brush dynamics, and HUD state. Modifying workspace store does **NOT** dirty the document or trigger undo steps.
3. **Asset Store:** Holds binary `Blob` and `ImageBitmap` references in a client-side LRU cache to conserve memory.

---

## 9. Technical Stack & Project Folder Structure

### 9.1 Unified Single Technical Stack (No Hybrid Contradictions)
- **Frontend Core:** React 19 (Client SPA) + TypeScript 5.x
- **Build Tool & Bundler:** **Vite 8** (with `@vitejs/plugin-react` and `@tailwindcss/vite`). Absolutely no Next.js or SSR overhead.
- **Styling & Design System:** Tailwind CSS v4 (Zero-runtime CSS engine with custom studio tokens).
- **Backend API & Service Layer:** **Express 4.x (`server.ts`)** running on Node.js via `tsx`:
  - Dev server proxy / Vite middleware integration.
  - Server-side Gemini API execution via `@google/genai` (secures `GEMINI_API_KEY`, zero client exposure).
  - WayForPay merchant API endpoints, HMAC-MD5 signature calculations, and secure webhook callback processing.
- **Icons & UI Primitives:** `lucide-react` (icons) and `motion` (fluid micro-interactions).
- **State Management:** `zustand` (fast, unopinionated, zero-boilerplate stores) with `immer` for immutable draft updates.
- **Canvas Rendering Engine:** Hybrid Compositing Pipeline:
  - Central Compositor: HTML5 Canvas 2D + OffscreenCanvas worker pipelines.
  - Shaders & Filter Pass: WebGL2 for real-time blend modes, color LUTs, and live split-curtain comparisons.
- **Payment Gateway:** **WayForPay** (Merchant signatures, order processing, webhook verification).

### 9.2 Folder & Module Structure

```
/
├── ARCHITECTURE.md                  <- This Architecture Specification (Unified Stack)
├── .env.example                     <- Environment variables specification
├── index.html                       <- HTML5 entry point & metadata
├── metadata.json                    <- Applet configuration & capabilities
├── package.json                     <- Single unified dependency manifest
├── tsconfig.json                    <- TypeScript configuration
├── vite.config.ts                   <- Vite build configuration
├── server.ts                        <- Express API server (Gemini proxy & WayForPay webhooks)
│
└── src/
    ├── main.tsx                     <- Application bootstrap
    ├── index.css                    <- Global Tailwind CSS tokens & base styles
    ├── App.tsx                      <- Shell Router & Layout Root
    │
    ├── shell/                       <- APPLICATION SHELL (FIRST PRIORITY)
    │   ├── AppShell.tsx             <- Top-level shell frame (Header + Sidebar + Viewport)
    │   ├── AppHeader.tsx            <- Unified global header
    │   ├── AppSidebar.tsx           <- Persistent primary navigation rail
    │   ├── AppStatusBar.tsx         <- Bottom status & telemetry bar
    │   ├── CommandPalette.tsx       <- Quick-action search modal
    │   └── ShellContext.tsx         <- Shell layout state provider
    │
    ├── ui/                          <- UNIFIED DESIGN SYSTEM PRIMITIVES
    │   ├── UIButton.tsx             <- Standard, ghost, icon, destructive buttons
    │   ├── UIInput.tsx              <- Text & search inputs
    │   ├── UIScrubberInput.tsx      <- Drag-to-change numeric scrubbers
    │   ├── UISlider.tsx             <- Precision range sliders
    │   ├── UIDropdown.tsx           <- Accessible select menus
    │   ├── UIModal.tsx              <- Backdrop modals & dialogs
    │   ├── UITooltip.tsx            <- Contextual tooltips with hotkeys
    │   ├── UIPanel.tsx              <- Studio docked collapsible panels
    │   ├── UIEmptyState.tsx         <- Standardized empty states
    │   └── UILoader.tsx             <- Spinners, skeleton bars, progress rings
    │
    ├── routes/                      <- ROUTE CONTROLLERS & VIEWS
    │   ├── ProjectsHub.tsx          <- /projects view
    │   ├── StudioWorkspace.tsx      <- /studio/:id view
    │   ├── AssetsLibrary.tsx        <- /assets view
    │   ├── GenerationsLog.tsx       <- /generations view
    │   ├── SettingsView.tsx         <- /settings view
    │   └── BillingView.tsx          <- /billing view (WayForPay)
    │
    ├── studio/                      <- STUDIO WORKSPACE ENGINE
    │   ├── components/
    │   │   ├── StudioSubHeader.tsx  <- Workspace-specific controls & zoom
    │   │   ├── StudioToolbar.tsx    <- Left tool palette (48px)
    │   │   ├── ToolContextBar.tsx   <- Active tool parameter bar
    │   │   ├── StudioCanvas.tsx     <- Viewport canvas container & render loops
    │   │   ├── LayersPanel.tsx      <- Layers tree, blend modes, masks
    │   │   ├── HistoryPanel.tsx     <- Undo/Redo stack viewer
    │   │   └── ExportModal.tsx      <- PNG/JPG/WebP export configurations
    │   │
    │   ├── tools/                   <- EDITING TOOLS IMPLEMENTATION
    │   │   ├── ToolManager.ts       <- Tool registry and event dispatcher
    │   │   ├── SelectTool.ts        <- Rectangle & Lasso selection
    │   │   ├── TransformTool.ts     <- Interactive bounding box & gizmo
    │   │   ├── BrushTool.ts         <- Soft/hard painting & flow
    │   │   ├── EraserTool.ts        <- Pixel & mask erasure
    │   │   └── CloneStampTool.ts    <- Source-sampling clone brush
    │   │
    │   └── engine/                  <- GRAPHICS COMPOSITING ENGINE
    │       ├── DocumentModel.ts     <- Document schema, layer tree operations
    │       ├── CanvasCompositor.ts  <- Multi-layer offscreen canvas blender
    │       ├── SelectionEngine.ts   <- Raster mask & polygon march engine
    │       └── ColorMath.ts         <- Color space conversions (RGB, HSL, LAB)
    │
    ├── harmonize/                   <- ARISTOCOLORS HARMONIZE ENGINE
    │   ├── HarmonizePanel.tsx       <- Right dock harmonizer interface
    │   ├── ManualHarmonizer.ts      <- Parametric color/light/shadow transfer
    │   ├── NeuralHarmonizer.ts      <- Gemini AI multi-modal image transformer
    │   ├── StylePresets.ts          <- Presets (Anime, Noir, Matte, Oil, etc.)
    │   └── BeforeAfterSlider.tsx    <- Interactive comparison overlay
    │
    ├── billing/                     <- WAYFORPAY PAYMENT INTEGRATION
    │   ├── WayForPayService.ts      <- Form payload builder & signature generator
    │   ├── PricingTiers.ts          <- Free vs Pro vs Studio feature matrix
    │   └── PaymentModal.tsx         <- WayForPay checkout trigger modal
    │
    ├── services/                    <- CORE SERVICES
    │   ├── GeminiClient.ts          <- Google GenAI SDK wrapper
    │   ├── StorageService.ts        <- IndexedDB local persistence
    │   └── ExportService.ts         <- High-res image download & serialization
    │
    └── state/                       <- CENTRAL STATE MANAGEMENT
        ├── useDocumentStore.ts      <- Project document & layers (SSOT)
        ├── useWorkspaceStore.ts     <- Viewport, tool selection, canvas zoom
        ├── useAssetStore.ts         <- Cached textures, cutouts, references
        └── useHistoryStore.ts       <- Command undo/redo stacks
```

---

## 10. Architectural Invariants & Measurable Acceptance Criteria

To ensure reliable, professional-grade delivery without technical regressions, all implementations must satisfy these architectural invariants.

### 10.1 Invariants (Non-Negotiable Rules)
1. **Application Shell Primacy:** The Application Shell (Header, Navigation, Projects Hub, Assets Library, Settings, Billing, Design System Primitives) must be fully developed and demonstrated before any photobashing tool or harmonization logic is wired up.
2. **One Design System Across All Pages:** Every view—from the Projects Hub to Settings to the Studio—must exclusively consume the unified UI component library (`ui/UIButton`, `ui/UIPanel`, etc.) and CSS design tokens. No ad-hoc, inline-styled buttons or misaligned color values.
3. **Zero Dead Controls:** No button, toggle, slider, or menu item may exist purely as a visual placeholder. If a control is rendered, it must have a defined handler, state mutation, or explicit disabled state with an explanatory tooltip.
4. **Non-Destructive Guarantee:** An image asset loaded into the studio is never irreversibly altered. Harmonization and inpainting operations must always output to separate layers or preview layers that can be reverted or deleted without degrading original sources.
5. **Billing Isolation:** Payment handling is designed around WayForPay (Ukrainian and international merchant standard), supporting merchant signatures, order references, currency parameters (`UAH`, `USD`, `EUR`), and callback redirection. Stripe is not used.
6. **Self-Contained File Integrity:** Implementation tasks must produce complete, standalone files suitable for manual copying into the local development repository.

### 10.2 Measurable Acceptance Criteria

#### Phase 1: Application Shell Acceptance (Current Priority)
- [ ] Global header and sidebar render consistently across all views (`/projects`, `/assets`, `/generations`, `/settings`, `/billing`, `/studio`).
- [ ] Sidebar collapses smoothly between 240px and 64px, persisting preference across reloads.
- [ ] Unified Design System renders clean typography, consistent dark surfaces, high-contrast text, and responsive button states (hover, active, disabled).
- [ ] Projects Hub supports creating a new project with customizable dimension presets (Square, 16:9 1080p, 4K Cinema, Ultrawide Concept) and opening existing projects into the Studio.
- [ ] Route navigation transitions between pages without layout shift or UI flickering.
- [ ] All empty states, loading indicators, and error modals comply with unified design tokens.

#### Phase 2: Studio Workspace & Photobashing Acceptance (Post-Shell)
- [ ] Canvas renders centered on screen with smooth pan (Spacebar + Drag) and zoom (Mouse wheel / Pinch) from 10% to 3200%.
- [ ] Layer panel allows adding new layers, deleting layers, toggling visibility, reordering via drag-and-drop, and setting blend modes.
- [ ] Selection tools (Marquee, Lasso) generate clear march contours; Cut/Copy/Paste extracts clean fragments into new layers.
- [ ] Layer mask painting accurately protects or reveals pixels without mutating RGB channels.
- [ ] Full undo/redo capability with at least 50 steps.

#### Phase 3: AristoColors Engine Acceptance (Post-Editor)
- [ ] Manual Harmonize dynamically recalculates color matching, light wrap, and contact shadow parameters in <16ms (60 FPS preview).
- [ ] Reference image and background style extraction accurately samples palette histograms and lighting vectors.
- [ ] AI Neural Harmonize securely communicates with Gemini image models, preserving subject silhouette while matching destination medium and lighting.
- [ ] Before/After interactive slider provides instantaneous comparison between original cutout and harmonized result.
- [ ] High-resolution export generates artifact-free PNG and JPEG outputs matching native canvas dimensions.

---
*End of Architecture Specification v2.0*
