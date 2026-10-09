import type { Game } from '../game/state.js';
import { cursorShade, ghostFrame, rewardShine, targetPulse } from './animation.js';
import { CHECKPOINT_FLASH_MS } from './constants.js';
import { guideStep } from './motionGuide.js';

/** Tracks animation frames without owning game state or terminal lifecycle. */
export class AnimationController {
  private previousCursorShade: number;
  private previousTargetPulse: number;
  private previousGhostFrame: number;
  private previousGuideStep: 0 | 1 | 2 = 0;
  private previousRewardShine = false;

  constructor(nowMs: number) {
    this.previousCursorShade = cursorShade(nowMs);
    this.previousTargetPulse = targetPulse(nowMs);
    this.previousGhostFrame = ghostFrame(nowMs);
  }

  needsRender(game: Game, nowMs: number): boolean {
    const shade = cursorShade(nowMs);
    const pulse = targetPulse(nowMs);
    const ghostStep = ghostFrame(nowMs);
    const age = nowMs - (game.lastHitAtMs ?? nowMs);
    const currentGuideStep = guideStep(age);
    const shining = rewardShine(age);
    const flashActive = game.phase === 'play' && game.lastHitAtMs !== null && age < CHECKPOINT_FLASH_MS;
    const changed = game.phase === 'reward' && (currentGuideStep !== this.previousGuideStep || shade !== this.previousCursorShade || shining !== this.previousRewardShine) ||
      game.phase === 'play' && (game.startedAtMs !== null || shade !== this.previousCursorShade || pulse !== this.previousTargetPulse || game.edit !== null && ghostStep !== this.previousGhostFrame) || flashActive;
    this.previousCursorShade = shade;
    this.previousTargetPulse = pulse;
    this.previousGhostFrame = ghostStep;
    this.previousGuideStep = currentGuideStep;
    this.previousRewardShine = shining;
    return changed;
  }
}
