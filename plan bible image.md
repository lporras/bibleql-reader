# RhemaPress — Verse Image Creator Plan

## 1. Feature Overview

Add a **Verse Image Creator** to RhemaPress, designed from the beginning to remain platform-independent so the application can move from Electron toward Tauri 2 and eventually support desktop, iPadOS/iOS, and Android.

The feature allows users to:

1. Choose a background image from Unsplash.
2. Upload a local image.
3. Select one or multiple Bible verses using the existing Bible viewer/reference selector.
4. Choose a visual style/template.
5. Customize typography and text appearance.
6. Position and resize Bible text on the image.
7. Export the result as PNG/JPEG using social-media-friendly presets.
8. Save the editable design as a local RhemaPress project.
9. Preserve image attribution/source metadata for externally sourced images.

### Primary UX

```text
Bible Viewer
    ↓
Select verses
    ↓
Create Image
    ↓
Choose background
    ├── Unsplash
    ├── Curated/local library
    └── My Images
    ↓
Design
    ├── Text
    ├── Font
    ├── Size
    ├── Color
    ├── Alignment
    ├── Position
    └── Template
    ↓
Preview
    ↓
Export / Copy / Share
```

## 2. Goals

### MVP goals

- Integrate Unsplash as a background-image provider.
- Allow local image uploads.
- Reuse RhemaPress's existing Bible/reference/verse selection UI.
- Support selecting multiple verses.
- Provide a dedicated visual editor.
- Support drag-and-drop positioning of text.
- Provide a small set of fonts and templates.
- Support common social image dimensions.
- Export high-quality PNG/JPEG images.
- Save and reopen editable projects.
- Preserve source/attribution metadata.
- Keep the feature modular and independent from the Bible viewer.

### Non-goals for MVP

Do not build a full Canva-like editor.

Do not implement:

- Advanced vector editing.
- Complex layers/effects.
- AI image generation.
- Direct publishing APIs for Instagram/Facebook/WhatsApp.
- Cloud project storage.
- User accounts.
- A large built-in image catalog.
- A new backend service unless required by the Unsplash integration.

## 3. Cross-Platform Architecture Requirement

The current application uses Electron, but Tauri 2 is being considered as the long-term application shell because it can target desktop and mobile platforms, including iOS/iPadOS.

**Do not rewrite the existing Electron application as part of the Image Creator MVP.**

Instead, use the Image Creator implementation as an opportunity to reduce platform coupling.

### Hard requirement

The Image Creator domain, project model, templates, typography configuration, Bible selection data, editor state, rendering model, and serialization must not directly depend on:

- Electron
- Node.js
- `ipcMain`
- `ipcRenderer`
- Electron filesystem APIs
- Electron clipboard APIs
- Electron window APIs
- Tauri-specific APIs
- iOS-specific APIs

Platform-specific operations must be isolated behind adapters/services.

Suggested abstraction:

```ts
interface PlatformCapabilities {
  saveFile(request: SaveFileRequest): Promise<SaveFileResult>
  openFile(request: OpenFileRequest): Promise<OpenFileResult>
  copyImageToClipboard(image: Blob): Promise<void>
  shareImage?(image: Blob, metadata?: ShareMetadata): Promise<void>
}
```

The exact interface should be adapted to the existing codebase.

### Target architecture

```text
                    Shared React/TypeScript
                             │
          ┌──────────────────┼──────────────────┐
          │                  │                  │
       BibleQL           Image Creator       Shared
       domain             domain/model        services
          │                  │                  │
          └──────────────────┼──────────────────┘
                             │
                     Platform adapters
                             │
             ┌───────────────┼────────────────┐
             │               │                │
          Electron        Tauri Desktop    Tauri Mobile
          (current)        (future)         (future)
             │               │                │
        Windows/macOS/     Windows/macOS/   iOS/iPadOS/
        Linux              Linux            Android
```

The Image Creator must work with the current Electron shell while remaining portable to Tauri.

## 4. Product Principles

### Simple first

The editor should feel like a Bible-focused design tool, not a general-purpose graphic editor.

### Bible-first

The primary entry point should be selecting Scripture, not designing an image.

### Local-first

Images, projects, and generated designs should work locally whenever possible.

### Provider-independent

The UI should not be tightly coupled to Unsplash. Design an image-provider abstraction so other sources can be added later.

### Export-friendly

The final result must be a normal PNG/JPEG that can be used outside RhemaPress.

---

# 4. User Flows

## Flow A — From Bible Viewer

```text
User opens Bible Viewer
        ↓
Selects translation
        ↓
Selects one or more verses
        ↓
Clicks "Create Image"
        ↓
Image Creator opens with selected Scripture
```

The selected Scripture should be passed into the editor as structured data, not only as a formatted string.

Example:

```ts
interface SelectedPassage {
  translationId: string
  bookId: string
  chapter: number
  verses: number[]
  text: string
  reference: string
}
```

For multiple ranges, support:

```ts
interface SelectedPassage {
  translationId: string
  ranges: Array<{
    bookId: string
    chapter: number
    verses: number[]
  }>
  text: string
  reference: string
}
```

## Flow B — From Image Creator

The user may also open Image Creator without preselected verses.

The editor should then provide:

```text
Add Scripture
```

which opens the existing Bible selection UI.

## Flow C — Unsplash

```text
Backgrounds
    ↓
Unsplash
    ↓
Search
    ↓
Results
    ↓
Select photo
    ↓
Image becomes editor background
```

Search examples:

- mountains
- sunrise
- ocean
- forest
- desert
- sky
- nature
- city
- church
- abstract

The application should not hard-code Christian-only search terms.

## Flow D — Local Image

```text
Backgrounds
    ↓
My Images
    ↓
Choose Image
    ↓
Native file picker
    ↓
Image becomes background
```

## Flow E — Export

```text
Export
    ↓
Choose preset
    ├── Instagram Story 1080x1920
    ├── Instagram Portrait 1080x1350
    ├── Square 1080x1080
    ├── Facebook Story 1080x1920
    ├── WhatsApp Status 1080x1920
    └── Custom
    ↓
PNG / JPEG
    ↓
Save file
```

---

# 5. Architecture

Keep the feature isolated under a dedicated feature module.

Suggested structure:

```text
src/
├── features/
│   ├── bible/
│   │   ├── ...
│   │
│   └── image-creator/
│       ├── components/
│       │   ├── ImageCreator.tsx
│       │   ├── EditorCanvas.tsx
│       │   ├── EditorToolbar.tsx
│       │   ├── BackgroundPanel.tsx
│       │   ├── UnsplashSearch.tsx
│       │   ├── LocalImagePicker.tsx
│       │   ├── ScripturePanel.tsx
│       │   ├── FontPicker.tsx
│       │   ├── TemplatePicker.tsx
│       │   ├── SocialPresetPicker.tsx
│       │   ├── ExportDialog.tsx
│       │   └── Attribution.tsx
│       │
│       ├── model/
│       │   ├── types.ts
│       │   ├── defaults.ts
│       │   └── validation.ts
│       │
│       ├── providers/
│       │   ├── ImageProvider.ts
│       │   ├── UnsplashProvider.ts
│       │   └── LocalImageProvider.ts
│       │
│       ├── rendering/
│       │   ├── renderProject.ts
│       │   ├── textLayout.ts
│       │   └── imageProcessing.ts
│       │
│       ├── persistence/
│       │   ├── projectStorage.ts
│       │   └── projectSerializer.ts
│       │
│       └── index.ts
│
├── assets/
│   └── fonts/
│
└── ...
```

Adapt the exact structure to the existing repository conventions instead of blindly creating this structure.

---

# 6. Editor Model

Use a serializable project model.

```ts
type CanvasPreset =
  | 'instagram-story'
  | 'instagram-portrait'
  | 'square'
  | 'facebook-story'
  | 'whatsapp-status'
  | 'custom'

interface CanvasSettings {
  width: number
  height: number
  preset: CanvasPreset
}

interface Background {
  type: 'unsplash' | 'local'
  sourceId?: string
  uri: string
  width?: number
  height?: number

  attribution?: {
    photographerName: string
    photographerUrl?: string
    sourceName: string
    sourceUrl?: string
  }

  crop: {
    x: number
    y: number
    scale: number
  }

  overlay?: {
    enabled: boolean
    color: string
    opacity: number
  }
}

interface TextElement {
  id: string
  type: 'scripture' | 'reference' | 'custom'

  text: string

  x: number
  y: number
  width: number
  height: number

  fontFamily: string
  fontSize: number
  fontWeight: number
  fontStyle: 'normal' | 'italic'

  color: string
  opacity: number

  textAlign: 'left' | 'center' | 'right'
  lineHeight: number

  shadow?: {
    enabled: boolean
    blur: number
    offsetX: number
    offsetY: number
    opacity: number
  }

  background?: {
    enabled: boolean
    color: string
    opacity: number
    padding: number
    radius: number
  }
}

interface BibleSource {
  translationId: string
  reference: string
  ranges: Array<{
    bookId: string
    chapter: number
    verses: number[]
  }>
}

interface ImageCreatorProject {
  version: 1

  id: string
  name: string

  canvas: CanvasSettings

  background: Background

  bibleSource?: BibleSource

  elements: TextElement[]

  createdAt: string
  updatedAt: string
}
```

Keep the project model versioned from day one.

---

# 7. Canvas Technology

Before implementation, inspect the existing frontend stack and dependencies.

Prefer a mature canvas/editor solution already compatible with the project's stack.

Candidate approaches:

1. HTML/CSS positioning with a dedicated export renderer.
2. Canvas-based editor.
3. A maintained React canvas library.

Do not introduce a large dependency without checking:

- bundle size
- Electron compatibility
- TypeScript support
- export quality
- device-pixel-ratio handling
- text measurement
- maintenance status
- licensing

The visual editor and final renderer should use the same project model.

---

# 8. Unsplash Integration

## Provider abstraction

Do not let components call Unsplash directly.

Use:

```ts
interface ImageProvider {
  search(query: string, page?: number): Promise<ImageSearchResult>
  getImage(id: string): Promise<ImageAsset>
}
```

Example:

```ts
interface ImageSearchResult {
  id: string
  thumbnailUrl: string
  previewUrl: string
  width: number
  height: number

  attribution: {
    photographerName: string
    photographerUrl?: string
    sourceName: string
    sourceUrl?: string
  }
}
```

## Credentials

Do not assume that an API secret can safely be embedded in an Electron renderer bundle.

Before implementation, inspect the Unsplash API application configuration and current API requirements.

If the integration requires a secret that must remain private, route requests through a trusted backend/proxy rather than shipping that secret in the desktop app.

If the Unsplash API permits the required client-side flow with a public application identifier, keep only the non-secret configuration in the application.

Document the decision in:

```text
docs/unsplash.md
```

## Attribution

Preserve attribution metadata for every Unsplash image.

The project should know:

- photo ID
- photographer
- photographer profile URL
- Unsplash/source URL

Do not strip this information after downloading/selecting the image.

Display attribution in the UI where required by the current Unsplash API terms.

Always verify the current Unsplash API terms/documentation before release because API policies can change.

## Downloading

Use the appropriate Unsplash image/download endpoint according to the current API documentation.

Do not treat thumbnail URLs as the final exported image source.

The editor should work with an adequately sized image.

---

# 9. Background Handling

When an image is selected:

1. Determine image dimensions.
2. Fit image to canvas.
3. Preserve aspect ratio.
4. Allow repositioning.
5. Allow zoom/crop.
6. Render the background at export resolution.

Default behavior should be equivalent to:

```text
object-fit: cover
```

with manual positioning available.

Add optional overlay:

```text
Black overlay
Opacity: 0–70%
```

This is especially useful for improving text readability.

---

# 10. Typography

Start with a curated set of fonts.

Suggested categories:

### Serif

- Cormorant Garamond
- Libre Baskerville
- Lora

### Sans

- Inter
- Montserrat
- Source Sans 3

### Display

- Playfair Display
- DM Serif Display

Only bundle fonts whose licenses permit redistribution.

Create a font registry:

```ts
interface FontDefinition {
  id: string
  family: string
  category: 'serif' | 'sans' | 'display'
  weights: number[]
}
```

Do not let users enter arbitrary font names in MVP.

---

# 11. Templates

Create templates as data rather than hard-coded UI.

Example:

```ts
interface ImageTemplate {
  id: string
  name: string

  backgroundOverlay?: {
    opacity: number
  }

  elements: Array<Partial<TextElement>>
}
```

Initial templates:

- Minimal
- Elegant
- Bold
- Centered
- Quote

A template should define typography/layout defaults while still allowing customization.

---

# 12. Scripture Text

The scripture element should retain its source information.

Do not only store:

```ts
text: "For God so loved..."
```

Store the source:

```ts
bibleSource: {
  translationId: "...",
  reference: "John 3:16",
  ranges: [...]
}
```

This allows:

- editing the selected passage
- changing translation
- displaying attribution
- rebuilding the text
- future project migrations

The exact formatting of the displayed text should be generated from structured Scripture data.

---

# 13. Multi-Verse Selection

Reuse the existing Bible viewer selection mechanism where possible.

Required:

```text
☑ John 3:16
☑ John 3:17
☑ John 3:18
```

Support non-contiguous selections if the existing RhemaPress architecture already supports them.

Example:

```text
John 3:16
John 3:18
Romans 8:28
```

The UI should clearly indicate that multiple passages are selected.

Avoid duplicating Bible-selection business logic inside Image Creator.

---

# 14. Social Presets

Define presets as configuration:

```ts
const SOCIAL_PRESETS = {
  instagramStory: {
    width: 1080,
    height: 1920
  },

  instagramPortrait: {
    width: 1080,
    height: 1350
  },

  square: {
    width: 1080,
    height: 1080
  },

  facebookStory: {
    width: 1080,
    height: 1920
  },

  whatsappStatus: {
    width: 1080,
    height: 1920
  }
}
```

Keep dimensions configurable so they can be updated later.

Add an optional safe-zone overlay for vertical social formats.

The safe zone should be visual only and must not appear in exported images.

---

# 15. Export

Implement a deterministic renderer:

```ts
renderProject(project): Promise<Blob | Buffer>
```

The renderer must:

- render at the exact target dimensions
- preserve image quality
- render text consistently
- handle fonts correctly
- support transparent/opaque backgrounds as appropriate
- avoid UI artifacts
- work independently from editor selection handles/guides

Formats:

```text
PNG
JPEG
```

JPEG quality should be configurable internally but can use a sensible default in MVP.

Electron should provide native save dialogs.

Suggested filenames:

```text
john-3-16-instagram-story.png
psalm-23-1-square.jpg
```

---

# 16. Copy / Share

MVP actions:

- Save to file
- Copy image to clipboard
- Open exported file/folder

Do not implement direct social publishing initially.

For desktop, use Electron/system APIs where appropriate.

Keep social publishing as a future extension point.

---

# 17. Project Persistence

Projects should be local.

Potential implementation:

```text
Documents/
└── BibleQL/
    └── Projects/
        ├── john-3-16.bibleql
        └── psalm-23.bibleql
```

A `.bibleql` project can be JSON-based.

If external/local image files are referenced, decide between:

### Option A — Reference files

Store the local path.

Pros:
- small project

Cons:
- project breaks if the source image moves.

### Option B — Copy image into project

Pros:
- portable project

Cons:
- larger files.

For MVP, prefer the simplest robust approach compatible with the current Electron storage architecture. Document the choice.

Unsplash metadata should always be persisted even if the downloaded image is stored locally.

---

# 18. UI Layout

Suggested editor:

```text
┌──────────────────────────────────────────────────────────┐
│ RhemaPress                         Save  Export       │
├───────────────┬──────────────────────────┬───────────────┤
│               │                          │               │
│ Background    │                          │ Properties    │
│               │                          │               │
│ Unsplash      │                          │ Font          │
│ My Images     │        CANVAS            │ Size          │
│               │                          │ Color         │
│ Scripture     │                          │ Alignment     │
│               │                          │ Position      │
│ Templates     │                          │ Shadow        │
│               │                          │               │
└───────────────┴──────────────────────────┴───────────────┘
```

Responsive behavior is less important than desktop usability because this is an Electron desktop application.

---

# 19. State Management

Inspect the existing application state-management approach first.

Do not introduce another state-management library unless necessary.

The Image Creator should have a single project state:

```ts
interface ImageCreatorState {
  project: ImageCreatorProject
  selectedElementId?: string
  history: HistoryState
  isDirty: boolean
}
```

Implement undo/redo early.

At minimum:

- Ctrl/Cmd + Z
- Ctrl/Cmd + Shift + Z or Ctrl/Cmd + Y

Undoable operations:

- move element
- resize element
- change font
- change size
- change color
- change text
- change background
- apply template

---

# 20. Accessibility

Ensure:

- buttons have labels
- keyboard navigation works
- controls have visible focus
- dialogs can be closed with Escape
- color controls have labels
- image results have meaningful accessible names
- editor controls do not rely only on color

Canvas interactions may be mouse-first, but important actions should remain keyboard accessible.

---

# 21. Error Handling

Handle:

### Unsplash

- network unavailable
- rate limit
- API error
- empty search
- malformed response
- image download failure

Show useful messages:

```text
Unable to load images from Unsplash.
Check your internet connection and try again.
```

Do not crash the editor if the image provider fails.

### Export

Handle:

- missing image
- unsupported image
- font loading failure
- filesystem failure
- insufficient permissions

---

# 22. Offline Behavior

RhemaPress should remain usable when offline.

If Unsplash is unavailable:

- previously downloaded/used project images should continue working
- local images should work
- the editor should work
- BibleQL data already available locally should continue working according to the application's existing behavior

Show:

```text
Unsplash is unavailable offline.
You can use a local image instead.
```

---

# 23. Security

Electron security is important.

Inspect existing:

- preload
- contextIsolation
- nodeIntegration
- IPC
- filesystem access

Do not expose unrestricted Node.js APIs to the renderer.

Any filesystem operations should go through the existing secure preload/IPC architecture.

If a backend/proxy is required for Unsplash credentials, never place private credentials in:

- renderer source
- Vite environment variables shipped to the client
- packaged JS
- project files
- logs

---

# 24. Testing

## Unit tests

Test:

- project serialization
- project migration/versioning
- social presets
- template generation
- Scripture formatting
- image positioning calculations
- canvas scaling
- export dimensions

## Integration tests

Test:

```text
Select verses
→ Create Image
→ choose background
→ edit text
→ export
```

Test both:

- Unsplash background
- local background

## Regression tests

Existing RhemaPress functionality must continue working.

Especially:

- Bible navigation
- translation selection
- verse selection
- search
- existing reader layouts

---

# 25. Implementation Phases

## Phase 0 — Repository discovery

Before coding:

1. Inspect the current repository.
2. Understand the React/Electron architecture.
3. Identify existing Bible viewer components.
4. Identify verse selection state.
5. Identify navigation/routing.
6. Identify state management.
7. Identify Electron preload/IPC APIs.
8. Identify existing file storage/export utilities.
9. Identify existing test setup.
10. Identify build targets.
11. Identify every place where renderer code depends directly on Electron/Node APIs.
12. Identify which of those dependencies can be abstracted for future Tauri support.

Do not modify code in this phase.

Deliverable:

```text
docs/image-creator-architecture.md
```

containing the findings and proposed integration points.

Also include:

```text
docs/platform-abstraction.md
```

describing the current Electron-specific boundaries and the proposed platform-neutral interfaces.

## Phase 0.5 — Tauri 2 feasibility spike

Do not migrate the application yet.

Create a short-lived prototype/branch to verify that the existing React frontend can run under Tauri 2.

The spike should answer:

- Can the existing frontend build/run under Tauri 2?
- Which Electron APIs are currently blocking portability?
- Can BibleQL API requests work unchanged?
- Can bundled fonts work?
- Can the Image Creator canvas/editor technology work?
- Can local image selection work through a platform adapter?
- Can image export work?
- Can clipboard access work?
- What would be required for iPad/iOS?
- Are any current dependencies incompatible with Tauri's webview model?

Do not attempt to port the entire application during this phase.

Deliverable:

```text
docs/tauri-feasibility.md
```

with:

- findings
- blockers
- required abstractions
- recommended migration strategy
- dependencies requiring replacement
- explicit decision: proceed / defer Tauri migration

If the spike reveals significant problems, keep Electron as the production shell and continue building the Image Creator against platform abstractions.

---

## Phase 1 — Data model

Implement:

- project model
- background model
- text element model
- Scripture source model
- social presets
- template model
- serialization/versioning
- platform-neutral file/share/clipboard interfaces where needed
- Electron adapter implementations for those interfaces

Add unit tests.

The Image Creator must consume the interfaces, never Electron APIs directly.

---

## Phase 2 — Basic editor

Implement:

- Image Creator route/view
- canvas
- local background
- scripture text
- reference text
- drag positioning
- basic typography controls

No Unsplash yet.

Goal:

```text
local image + selected verses → editable design
```

---

## Phase 3 — Bible Viewer integration

Add:

```text
Select verses → Create Image
```

Pass structured Bible selection into Image Creator.

Also support:

```text
Image Creator → Add Scripture
```

using the existing selection components where practical.

---

## Phase 4 — Unsplash

Implement:

- provider abstraction
- Unsplash provider
- search
- pagination/load more
- image selection
- attribution metadata
- image download/cache strategy

Before merging this phase, verify current Unsplash API requirements and terms.

---

## Phase 5 — Templates and typography

Add:

- font registry
- bundled fonts
- templates
- overlay
- shadow
- text background
- alignment controls

---

## Phase 6 — Export

Implement:

- PNG
- JPEG
- social presets
- custom dimensions
- native Save dialog
- filename generation
- clipboard copy

Add automated export tests.

---

## Phase 7 — Project persistence

Implement:

- New project
- Save
- Save As
- Open
- recent projects if consistent with existing app UX
- `.bibleql` project format
- migration/versioning

---

## Phase 8 — Polish

Add:

- undo/redo
- keyboard shortcuts
- safe zones
- loading states
- empty states
- error handling
- accessibility
- offline behavior
- performance optimization

---

# 26. Suggested MVP Acceptance Criteria

The feature is ready when all of the following work:

### Background

- [ ] User can select a local image.
- [ ] User can search Unsplash.
- [ ] User can select an Unsplash result.
- [ ] Selected image becomes the background.
- [ ] Background can be repositioned/cropped.
- [ ] Attribution metadata is preserved.

### Bible

- [ ] User can select one verse.
- [ ] User can select multiple verses.
- [ ] Translation information is preserved.
- [ ] Reference is displayed.
- [ ] User can modify the Scripture selection.

### Editor

- [ ] Scripture can be moved.
- [ ] Scripture can be resized.
- [ ] Font can be changed.
- [ ] Font size can be changed.
- [ ] Color can be changed.
- [ ] Alignment can be changed.
- [ ] Overlay can be enabled.
- [ ] At least five templates exist.

### Export

- [ ] Instagram Story works.
- [ ] Instagram portrait works.
- [ ] Square works.
- [ ] Facebook Story works.
- [ ] WhatsApp Status works.
- [ ] PNG export works.
- [ ] JPEG export works.
- [ ] Native file save works.
- [ ] Clipboard copy works.

### Projects

- [ ] Project can be saved.
- [ ] Project can be reopened.
- [ ] Project retains Scripture metadata.
- [ ] Project retains background metadata.
- [ ] Project retains layout.
- [ ] Project version is stored.

### Quality

- [ ] Existing Reader functionality is unaffected.
- [ ] Offline/local-image workflow works without Unsplash.
- [ ] Unsplash failure does not crash the editor.
- [ ] No private Unsplash credentials are exposed in the renderer.
- [ ] Tests pass.
- [ ] TypeScript checks pass.
- [ ] Production Electron builds pass.

---

# 27. Performance Requirements

The editor should not load full-resolution versions of every search result.

Use:

```text
Search results → thumbnails
Selected image → appropriate larger asset
Export → target-resolution rendering
```

Avoid keeping unnecessary full-resolution copies in React state.

Large images should be processed outside normal React render cycles where appropriate.

Debounce Unsplash search requests.

Example:

```text
User types:
"m"
"mo"
"mou"
"moun"
"mount"
"mounta"
"mountain"

Only issue the API request after a short debounce.
```

---

# 28. Future Extensions

Do not implement these in MVP, but design the architecture so they are possible.

### AI-assisted layouts

```text
"Create a peaceful design for Psalm 23"
```

AI returns design configuration rather than necessarily generating the image.

### More image providers

Possible future providers:

```text
Unsplash
Pexels
Pixabay
BibleQL curated images
```

### Stickers

- crosses
- stars
- decorative lines
- shapes

### More elements

```text
Title
Subtitle
Verse
Reference
Custom text
Logo
QR code
```

### QR codes

Generate a QR pointing to a BibleQL passage URL.

### Cloud projects

Future authenticated users could synchronize projects.

### Direct sharing

Investigate platform-specific sharing/publishing capabilities later.

---

# 29. Important Design Decision

Do not make the BibleQL backend responsible for image composition.

The responsibilities should remain:

```text
BibleQL API
    = Bible data

RhemaPress
    = reading + design + export

Unsplash
    = external background images
```

This keeps the open-source API focused and keeps the image creator primarily a desktop feature.

If Unsplash credentials require a server-side proxy, that proxy should be isolated from BibleQL's core GraphQL domain rather than adding image-generation concerns to the core API.

---

# 30. Claude Code Instructions

When implementing this plan:

1. First inspect the repository.
2. Read existing architecture and conventions before creating files.
3. Do not rewrite unrelated components.
4. Reuse existing Bible/reference/verse-selection functionality.
5. Reuse existing Electron IPC/storage patterns.
6. Reuse existing UI components/design system.
7. Avoid introducing dependencies unless they solve a clear problem.
8. Prefer small, reviewable commits.
9. Run TypeScript checks after each major phase.
10. Run existing tests before and after changes.
11. Add tests for all new business logic.
12. Do not expose Unsplash secrets in the renderer.
13. Verify current Unsplash API requirements before implementation.
14. Preserve Unsplash attribution/source metadata.
15. Keep Image Creator independent from Unsplash through a provider interface.
16. Keep the project format versioned.
17. Do not implement future features unless required by the current phase.
18. Update documentation when architecture or external API requirements change.
19. If a dependency is fundamentally Electron-specific, document why it is needed and whether a Tauri-compatible alternative exists.
20. Do not start a full Electron-to-Tauri migration unless explicitly requested; the Tauri feasibility spike is the first step.

Suggested commit sequence:

```text
feat(platform): add platform abstraction
feat(image-creator): add project model
feat(image-creator): add basic editor
feat(image-creator): integrate bible verse selection
feat(image-creator): add Unsplash provider
feat(image-creator): add templates and typography
feat(image-creator): add social export presets
feat(image-creator): add project persistence
feat(image-creator): add undo redo and polish
```

---

# 31. Definition of Done

The feature should be considered complete when a new user can perform this workflow without developer intervention:

```text
Open RhemaPress
      ↓
Select John 3:16–17
      ↓
Click "Create Image"
      ↓
Search Unsplash for "sunrise"
      ↓
Select a photo
      ↓
Choose "Elegant" template
      ↓
Change font
      ↓
Move Scripture to desired position
      ↓
Choose Instagram Story
      ↓
Preview
      ↓
Export PNG
      ↓
Open the generated image
```

The generated image should be production-quality, the project should be reopenable, and all relevant Scripture/background metadata should remain available.

