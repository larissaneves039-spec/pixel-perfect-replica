export const EFFECTS = ["zoom-in", "zoom-out", "pan-left", "pan-right", "zoom-in-fast"] as const;
export type Effect = (typeof EFFECTS)[number];
export const MAX_SLOTS = 600;

export interface Slot {
  index: number;
  sectionIndex: number;
  slotInSection: number;
  startTime: number;
  duration: number;
  effect: Effect;
}

export interface PlanResult {
  slots: Slot[];
  effectiveMaxMedia: number;
  adjusted: boolean;
}

function normWeights(weights: number[]): number[] {
  const w = weights.length ? weights.map((x) => Math.max(0, x || 0)) : [1];
  const sum = w.reduce((a, b) => a + b, 0);
  return sum > 0 ? w.map((x) => x / sum) : w.map(() => 1 / w.length);
}

function countSlots(total: number, maxMedia: number, w: number[]) {
  return w.reduce((n, x) => n + Math.max(1, Math.ceil((total * x) / maxMedia - 1e-9)), 0);
}

export function planSlots(totalSeconds: number, maxMedia: number, weights: number[] = []): PlanResult {
  const w = normWeights(weights);
  let mm = maxMedia;
  let adjusted = false;
  if (countSlots(totalSeconds, mm, w) > MAX_SLOTS) {
    mm = Math.max(mm, Math.ceil(totalSeconds / MAX_SLOTS));
    while (countSlots(totalSeconds, mm, w) > MAX_SLOTS) mm += 1;
    adjusted = true;
  }
  const slots: Slot[] = [];
  let t = 0;
  w.forEach((weight, sectionIndex) => {
    const secDur = totalSeconds * weight;
    const count = Math.max(1, Math.ceil(secDur / mm - 1e-9));
    const dur = secDur / count;
    for (let i = 0; i < count; i++) {
      slots.push({
        index: slots.length,
        sectionIndex,
        slotInSection: i,
        startTime: t,
        duration: dur,
        effect: EFFECTS[(sectionIndex + i) % EFFECTS.length],
      });
      t += dur;
    }
  });
  return { slots, effectiveMaxMedia: mm, adjusted };
}

export function nextEffect(e: Effect): Effect {
  return EFFECTS[(EFFECTS.indexOf(e) + 1) % EFFECTS.length];
}
