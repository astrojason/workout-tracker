# Equipment Detail Manager — Implementation Plan

## Context

All equipment is currently hardcoded in `web/src/lib/equipment-calculator.ts`. The actual inventory is documented in `Gym_Equipment.md` at the project root — the hardcoded defaults already match it. This feature adds a Settings page where users can view and edit their equipment config, persisted to Firestore and used everywhere the calculator runs: the active workout display, rest timer, and program editor.

---

## Design Decisions (resolved)

| Decision | Choice |
|---|---|
| iOS scope | Web-only |
| Calculator wiring scope | All call sites: ExerciseEditor, ActiveWorkout, RestTimer |
| Assisted pullup | Band-count model is correct (no machine) |
| Loop bands | Add `loopBands: string[]` to config + UI section; exercise wiring deferred |
| Plate storage primitive | `totalOwned` (not `maxPerSide`); fixes landmine bug |
| Plate denominations | Fixed standard set; no custom denominations |
| Grippers | Add `grippers: string[]` + GripperSection |
| PowerBlock range | Editable (`minLbs` / `maxLbs`) |
| Assisted pullup band max | Add `assistedPullupBands: number`; caps ExerciseEditor input |
| Save UX | Explicit "Save Changes" button; no auto-save |
| Empty config arrays | Fall back to full default list (prevents broken edit state) |
| First-time seeding | No auto-seed; Firestore doc created only on first explicit save |

---

## Updated `UserEquipmentConfig` Type (`web/src/lib/types.ts`)

```typescript
export type BandColor = "Orange" | "Purple" | "Red" | "Blue" | "Green" | "Black";
export const ALL_BAND_COLORS: BandColor[] = ["Orange", "Purple", "Red", "Blue", "Green", "Black"];

export type LoopBandSize = "Ultra-light" | "Light" | "Medium" | "Heavy" | "X-heavy" | "XX-heavy";
export const ALL_LOOP_BAND_SIZES: LoopBandSize[] = ["Ultra-light", "Light", "Medium", "Heavy", "X-heavy", "XX-heavy"];

// Captains of Crush levels
export type CoCLevel = "T" | "0.5" | "1" | "1.5" | "2" | "2.5" | "3" | "3.5" | "4";
export const ALL_COC_LEVELS: CoCLevel[] = ["T", "0.5", "1", "1.5", "2", "2.5", "3", "3.5", "4"];

export interface UserEquipmentConfig {
  barbells: {
    has45lb: boolean;
    has35lb: boolean;
    hasEZBar: boolean;
  };
  // totalOwned = total physical plates across both sides
  // Calculator derives per-side limit: barbell → floor(totalOwned/2), landmine → totalOwned
  plates: { weight: number; totalOwned: number }[];  // ordered largest → smallest
  powerBlock: {
    owned: boolean;
    minLbs: number;   // default 5
    maxLbs: number;   // default 50
  };
  fixedDumbbells: number[];
  kettlebells: number[];        // sorted ascending
  bands: BandColor[];           // owned Serious Steel bands
  loopBands: LoopBandSize[];    // owned loop bands (exercise wiring deferred)
  assistedPullupBands: number;  // count of bands available for pullup assist
  grippers: CoCLevel[];         // owned Captains of Crush levels
}
```

---

## Phase 1 — Type Definitions (`web/src/lib/types.ts`)

Add all types above. No existing types changed.

---

## Phase 2 — Firestore (`web/src/lib/firestore.ts`)

New Firestore doc: `/users/{userId}/settings/equipment` (parallel to existing `prefs` doc).

```typescript
export async function getEquipmentConfig(userId: string): Promise<UserEquipmentConfig | null>
export async function saveEquipmentConfig(userId: string, config: UserEquipmentConfig): Promise<void>
```

- `setDoc` with full replacement (not merge) — `plates` array is order-dependent
- Returns `null` when no doc exists; callers fall back to `DEFAULT_EQUIPMENT_CONFIG`
- No auto-seed: doc is created only when user explicitly saves from the UI

---

## Phase 3 — equipment-calculator.ts Refactor (`web/src/lib/equipment-calculator.ts`)

**Zero changes to existing test behavior** — all new params optional, defaults match current hardcoded values.

### Plate primitive change
`DEFAULT_PLATES` switches from `maxPerSide` to `totalOwned`. Update `findPlates` signature:

```typescript
function findPlates(
  target: number,
  plates: { weight: number; totalOwned: number }[] = DEFAULT_PLATES,
  loadingSides: 1 | 2 = 2
): ...
// Per-side limit derived internally: Math.floor(totalOwned / loadingSides)
```

- `calculateBarbell` calls `findPlates(..., 2)` — symmetric loading
- `calculateLandmine` calls `findPlates(..., 1)` — one-sided loading (fixes existing bug where landmine was limited to half available plates)

### New exports
- Export `DEFAULT_PLATES` (currently unexported)
- Export `DEFAULT_EQUIPMENT_CONFIG: UserEquipmentConfig` — canonical defaults derived from existing constants; also seeds Firestore on first explicit save

### Config-aware functions (add optional `config?: UserEquipmentConfig` as last param)
- `calculateBarbell` — uses `config?.plates ?? DEFAULT_PLATES`
- `calculateLandmine` — same
- `nearestPowerBlock` — clamps to `config?.powerBlock.minLbs ?? 5` / `config?.powerBlock.maxLbs ?? 50`
- `getEquipmentDisplay` — threads config to internal calls; powerblock-not-owned branch falls back to dumbbell

**Not changed:** `plateDisplayString`, `plateFullDisplayString`, `equipmentDisplayText`, `equipmentShortText` — pure display transforms on already-resolved data.

---

## Phase 4 — `useEquipmentConfig` Hook (`web/src/hooks/useEquipmentConfig.ts`)

New file, mirrors `usePrograms` pattern.

```typescript
export function useEquipmentConfig(userId: string | null): {
  config: UserEquipmentConfig;  // never null — always falls back to DEFAULT_EQUIPMENT_CONFIG
  loading: boolean;
  saving: boolean;
  saveConfig: (config: UserEquipmentConfig) => Promise<void>;
}
```

- Optimistic update in `saveConfig`; reverts + calls `showError` on failure
- Empty config arrays (`kettlebells: []`, etc.) are stored as-is — fallback to defaults happens at the call site in ExerciseEditor, not in the hook

---

## Phase 5 — Equipment Manager UI

### Settings link (`web/src/app/settings/page.tsx`)
Add Equipment section with chevron-link to `/settings/equipment` — same pattern as existing settings rows.

### New route: `web/src/app/settings/equipment/page.tsx`
- Auth guard + `useEquipmentConfig(user?.uid ?? null)`
- Local **draft state** — user edits locally, saves explicitly
- `isDirty = JSON.stringify(draft) !== JSON.stringify(config)`
- Sticky save bar at `bottom-16` (above BottomNav), visible only when isDirty

### New section components in `web/src/components/settings/`

| File | UI |
|---|---|
| `BarbellSection.tsx` | 3 toggle rows: Olympic Bar (45 lb), 35 lb Bar, EZ Bar (15 lb) |
| `PlatesSection.tsx` | Stepper (− / n / +) for `totalOwned` per denomination; denominations fixed; step min 0 |
| `PowerBlockSection.tsx` | Owned toggle + editable number inputs for `minLbs` / `maxLbs` |
| `KettlebellsSection.tsx` | Chip multi-select from reference list + custom weight add input |
| `BandsSection.tsx` | Checkboxes for 6 Serious Steel colors with resistance range |
| `LoopBandsSection.tsx` | Checkboxes for 6 loop band sizes |
| `FixedDumbbellsSection.tsx` | Tag list with × remove + number input to add |
| `GripperSection.tsx` | Checkboxes for CoC levels T through 4 |
| `AssistedPullupSection.tsx` | Single number stepper for band count max |

All sections: `(config: UserEquipmentConfig, onChange: (patch: Partial<UserEquipmentConfig>) => void)`.

**Plate ordering invariant:** `PlatesSection` always writes plates largest → smallest. Required by greedy algorithm. No UI reordering.

---

## Phase 6 — Full Calculator Wiring (all call sites)

The config must replace hardcoded defaults everywhere `getEquipmentDisplay` / `calculateBarbell` / `nearestPowerBlock` are called.

### `web/src/app/page.tsx`
Add `useEquipmentConfig(user?.uid ?? null)`, pass `equipmentConfig` to `ActiveWorkout`.

### `web/src/components/workout/ActiveWorkout.tsx`
Accept `equipmentConfig?: UserEquipmentConfig` prop, pass to `getEquipmentDisplay` (line 188) and to `RestTimer`.

### `web/src/components/workout/RestTimer.tsx`
Accept `equipmentConfig?: UserEquipmentConfig` prop, pass to both `getEquipmentDisplay` calls (lines 34, 40).

### `web/src/components/programs/ExerciseEditor.tsx`
Add optional `equipmentConfig?: UserEquipmentConfig` prop:
- Kettlebell dropdown: `config?.kettlebells?.length ? config.kettlebells : KETTLEBELL_WEIGHTS`
- Serious Steel band dropdown: filter `BAND_OPTIONS` to `config?.bands ?? ALL_BAND_COLORS`
- Assisted pullup band count: `max={config?.assistedPullupBands ?? 10}`
- Barbell plate hints: pass `config` to `calculateBarbell`
- PowerBlock clamping: pass `config` to `nearestPowerBlock`

### `web/src/app/programs/[id]/page.tsx`
Add `useEquipmentConfig` call, pass `equipmentConfig` to `ExerciseEditor`.

---

## Phase 7 — Tests (`web/src/lib/__tests__/equipment-config.test.ts`)

New test file:
- `calculateBarbell` with limited `totalOwned` plate config
- `calculateLandmine` correctly uses full `totalOwned` (not half) — verifies the bug fix
- `nearestPowerBlock` with custom `minLbs`/`maxLbs`
- `DEFAULT_EQUIPMENT_CONFIG` values match existing exported constants
- `getEquipmentDisplay` powerblock-not-owned → dumbbell fallback

**Existing `equipment-calculator.test.ts` (768 lines): zero changes** — all refactored functions default to existing behavior when called without config.

---

## Updated File Inventory

| File | Change |
|---|---|
| `web/src/lib/types.ts` | Add `BandColor`, `LoopBandSize`, `CoCLevel`, `ALL_*` constants, `UserEquipmentConfig` |
| `web/src/lib/firestore.ts` | Add `getEquipmentConfig`, `saveEquipmentConfig` |
| `web/src/lib/equipment-calculator.ts` | `totalOwned` primitive, export `DEFAULT_PLATES` + `DEFAULT_EQUIPMENT_CONFIG`, optional `config` param, `findPlates` loadingSides param |
| `web/src/hooks/useEquipmentConfig.ts` | New file |
| `web/src/app/settings/page.tsx` | Add Equipment nav link |
| `web/src/app/settings/equipment/page.tsx` | New file |
| `web/src/components/settings/BarbellSection.tsx` | New |
| `web/src/components/settings/PlatesSection.tsx` | New |
| `web/src/components/settings/PowerBlockSection.tsx` | New |
| `web/src/components/settings/KettlebellsSection.tsx` | New |
| `web/src/components/settings/BandsSection.tsx` | New |
| `web/src/components/settings/LoopBandsSection.tsx` | New |
| `web/src/components/settings/FixedDumbbellsSection.tsx` | New |
| `web/src/components/settings/GripperSection.tsx` | New |
| `web/src/components/settings/AssistedPullupSection.tsx` | New |
| `web/src/components/programs/ExerciseEditor.tsx` | Add optional `equipmentConfig` prop + empty-array fallbacks |
| `web/src/app/programs/[id]/page.tsx` | Wire `useEquipmentConfig` + prop to ExerciseEditor |
| `web/src/app/page.tsx` | Wire `useEquipmentConfig` + prop to ActiveWorkout |
| `web/src/components/workout/ActiveWorkout.tsx` | Accept + thread `equipmentConfig` to getEquipmentDisplay + RestTimer |
| `web/src/components/workout/RestTimer.tsx` | Accept + thread `equipmentConfig` to getEquipmentDisplay |
| `web/src/lib/__tests__/equipment-config.test.ts` | New |

---

## Sequencing

```
Phase 1 (types)
  ├─→ Phase 2 (firestore)
  └─→ Phase 3 (calculator — totalOwned refactor + config param)
        └─→ Phase 4 (hook)
              ├─→ Phase 5 (UI manager)
              └─→ Phase 6 (full calculator wiring)
Phase 7 (tests) — written alongside Phase 3, run after
```

Each phase compiles and passes tests independently.

---

## Verification

1. `npm run build` passes after each phase
2. `npm test` — all 768 existing tests pass + new equipment-config tests pass (especially landmine fix)
3. Browser: Settings → Equipment → reduce plate counts → Save → reload → persists
4. Browser: live workout with barbell exercise → plate display reflects configured plates
5. Browser: ExerciseEditor → band dropdown shows only owned bands
6. Browser: first visit to equipment page → shows correct defaults, no Firestore write until Save
