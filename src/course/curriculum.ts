import { stageIds, challengeTitles } from '../lessons/catalog.js';
import type { Motion } from '../vim/motion.js';
import { movement } from './sections/movement.js';
import { insertion } from './sections/insertion.js';
import { editing } from './sections/editing.js';
import { textObjects } from './sections/textObjects.js';
import { visual } from './sections/visual.js';
import type { CourseExample, CourseTopic } from './types.js';

export const courseSections = [movement, insertion, editing, textObjects, visual] as const;
export const courseTopics = courseSections.flatMap(section => [...section.topics]);
export const sectionFor = (id: string | null) => courseSections.find(section => section.id === id);
export const topicFor = (id: string | null) => courseTopics.find(topic => topic.id === id);
export const examplePracticeId = (topic: CourseTopic, example: CourseExample): string => `course:${topic.id}:${example.id}`;
export const topicPracticeId = (topic: CourseTopic): string => `course:${topic.id}:mixed`;
export const topicPracticeIds = (topic: CourseTopic): string[] => [
  topicPracticeId(topic),
];
export const extraPracticeIds = new Set(courseTopics.flatMap(topic => [topicPracticeId(topic), ...topic.examples.map(example => examplePracticeId(topic, example))]));
export const navigationCommands = ['h', 'j', 'k', 'l', 'w', 'e', 'b', 'W', 'E', 'B', '0', '^', '_', '$', 'gg', 'G', 'Counts', 'f', 'F', 't', 'T', ';', ',', '/', '?', 'n', 'N', '*', '#', '{', '}', '%', '\x04', '\x15'] as const;

export const coursePracticeIds = [...new Set([
  ...courseTopics.flatMap(topicPracticeIds), ...stageIds,
  ...courseTopics.flatMap(topic => topic.examples.map(example => examplePracticeId(topic, example))),
])];
export function practiceTitle(id: string): string {
  for (const topic of courseTopics) {
    if (topicPracticeId(topic) === id) return `${topic.title}: mixed practice`;
    const example = topic.examples.find(example => examplePracticeId(topic, example) === id);
    if (example) return `${topic.title}: ${example.command}`;
  }
  const index = stageIds.indexOf(id as typeof stageIds[number]);
  return index >= 0 ? challengeTitles[index]! : id;
}

export const courseMotions: readonly Motion[] = ['h', 'j', 'k', 'l', 'w', 'e', 'b', 'W', 'E', 'B', '0', '^', '$', 'gg', 'G'];
