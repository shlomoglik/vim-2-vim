import type { BonusObjective, BonusResult } from '../lessons/types.js';

export function evaluateBonuses(objectives: readonly BonusObjective[], commands: readonly string[], actualKeys: number, stage: number): BonusResult[] {
  return objectives.map(objective => {
    let earned: boolean;
    switch (objective.kind) {
      case 'count': earned = commands.includes('Counts'); break;
      case 'keys': earned = actualKeys <= objective.maxKeys; break;
      case 'commands': earned = objective.commands.every(command => commands.includes(command)); break;
      case 'avoid': earned = objective.commands.every(command => !commands.includes(command)); break;
    }
    return { id: `${stage}:${objective.id}`, label: `${stage}. ${objective.label}`, earned };
  });
}
