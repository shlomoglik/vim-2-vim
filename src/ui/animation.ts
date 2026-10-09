import { CURSOR_BEAT_MS, CURSOR_FIRST_DIP_MS, CURSOR_SECOND_DIP_END_MS, CURSOR_SECOND_DIP_START_MS, GHOST_FRAME_MS, REWARD_SHINE_FRAME_MS, REWARD_SHINE_MS, TARGET_PULSE_MS } from './constants.js';

// Two short brightness dips, then a rest: a quiet heartbeat without hiding the glyph.
export function cursorShade(nowMs: number): number {
  const beat = nowMs % CURSOR_BEAT_MS;
  return beat < CURSOR_FIRST_DIP_MS ? 253 : beat >= CURSOR_SECOND_DIP_START_MS && beat < CURSOR_SECOND_DIP_END_MS ? 251 : 255;
}
export const targetPulse = (nowMs: number) => Math.floor(nowMs / TARGET_PULSE_MS) % 2;
export const ghostFrame = (nowMs: number) => Math.floor(nowMs / GHOST_FRAME_MS);
export const ghostColors = [108, 114, 150, 151, 150, 114] as const;
export const ghostColor = (frame: number, col: number, row: number) => ghostColors[(frame + Math.floor(col / 2) + row) % ghostColors.length]!;
export const rewardShine = (ageMs: number) => ageMs >= 0 && ageMs < REWARD_SHINE_MS && Math.floor(ageMs / REWARD_SHINE_FRAME_MS) % 2 === 1;

