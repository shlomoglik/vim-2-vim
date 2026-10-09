import { createExamplePractice, createTopicPractice, extraPractices } from '../course/practices.js';
import { courseTopics, topicPracticeId } from '../course/curriculum.js';
import type { Motion } from '../vim/motion.js';
import { advancedLesson } from './advanced.js';
import { legacyIds, stageBadge, stageIds } from './catalog.js';
import { createLesson as navigator } from './definitions/navigator.js';
import { createLesson as reviewFinds } from './definitions/review-finds.js';
import { createLesson as reviewLines } from './definitions/review-lines.js';
import { createLesson as reviewSearch } from './definitions/review-search.js';
import { createLesson as reviewWords } from './definitions/review-words.js';
import { editingLesson } from './editing.js';
import { foundationalLesson, isFoundationLesson } from './foundation.js';
import type { Difficulty, Lesson, LessonFactory } from './types.js';

/** Stable course IDs decouple lesson authoring from runtime state and save keys. */
export class LessonCatalog {
  private readonly factories = new Map<string, LessonFactory>();

  constructor() {
    for (const id of legacyIds) {
      const legacyIndex = legacyIds.indexOf(id);
      this.register(id, (index, difficulty, unlocked) => {
        const build = isFoundationLesson(id) ? foundationalLesson : advancedLesson;
        const lesson = build(legacyIndex, difficulty, [...unlocked, stageBadge(index) as Motion]);
        return { ...lesson, id, title: `${index + 1} · ${lesson.title.split('· ')[1]}`, badge: stageBadge(index) };
      });
    }
    this.register('review-words', reviewWords);
    this.register('review-lines', reviewLines);
    this.register('review-finds', reviewFinds);
    this.register('review-search', reviewSearch);
    this.register('navigator', navigator);
    for (const id of stageIds.filter(id => id.startsWith('edit-'))) this.register(id, editingLesson);
  }

  createById(id: string, difficulty: Difficulty, unlocked: readonly Motion[], earned: readonly string[] = unlocked): Lesson {
    const topic = courseTopics.find(topic => topicPracticeId(topic) === id);
    if (topic) return createTopicPractice(topic, earned);
    const index = stageIds.indexOf(id as typeof stageIds[number]);
    if (index >= 0) return this.create(index, difficulty, unlocked);
    const practice = extraPractices.get(id);
    if (!practice) throw new RangeError(`Unknown practice ${id}`);
    return createExamplePractice(practice.topic, practice.example);
  }

  register(id: string, factory: LessonFactory): void {
    this.factories.set(id, factory);
  }

  create(index: number, difficulty: Difficulty, unlocked: readonly Motion[]): Lesson {
    const id = stageIds[index];
    const factory = id && this.factories.get(id);
    if (!factory) throw new RangeError(`Unknown lesson ${index}`);
    return factory(index, difficulty, unlocked);
  }
}

export const defaultLessonCatalog = new LessonCatalog();
export const lessonFor = (index: number, difficulty: Difficulty, unlocked: readonly Motion[]): Lesson =>
  defaultLessonCatalog.create(index, difficulty, unlocked);
