import type { TemperatureClass } from '@ag/observability';
import { SubjectClassSource } from './temperature.types';

/**
 * Resolves a subject's temperature class. Until the catalogue join is wired
 * (variant → temperature class), the caller supplies a map; anything unknown
 * falls back to chilled, the strictest band, so an unclassified subject is
 * never silently treated as safe.
 */
export class InMemorySubjectClassSource implements SubjectClassSource {
  constructor(
    private readonly classes: Record<string, TemperatureClass> = {},
    private readonly fallback: TemperatureClass = 'chilled',
  ) {}

  async classOf(_subjectType: string, subjectId: string): Promise<TemperatureClass> {
    return this.classes[subjectId] ?? this.fallback;
  }
}
