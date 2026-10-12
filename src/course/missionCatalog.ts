export const puzzleMissions = [
  { id: 'puzzle:word-movement:islands', topicId: 'word-movement', title: 'Stepping stones', stages: 3 },
  { id: 'puzzle:WORD-movement:islands', topicId: 'WORD-movement', title: 'Column garden', stages: 3 },
  { id: 'puzzle:edit-lines:trail', topicId: 'edit-lines', title: 'Clear the trail', stages: 1 },
  { id: 'puzzle:copy-paste:harbor', topicId: 'copy-paste', title: 'Harbor rescue', stages: 3 },
] as const;
export const missionsForTopic = (topicId: string) => puzzleMissions.filter(mission => mission.topicId === topicId);

