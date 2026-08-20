import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { WALKTHROUGHS } from './walkthroughs';

const SOURCE_ROOT = join(__dirname, '..');

/** Component files only. Test files are excluded so a marker asserted in a
    test cannot stand in for one that was never added to the component. */
const componentFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return componentFiles(path);
    return path.endsWith('.tsx') && !path.includes('.test.') ? [path] : [];
  });

const declaredMarkers = () => {
  const found = new Set<string>();
  for (const file of componentFiles(SOURCE_ROOT)) {
    for (const match of readFileSync(file, 'utf8').matchAll(/data-walkthrough="([^"]+)"/g)) {
      const marker = match[1];
      if (marker) found.add(marker);
    }
  }
  return found;
};

const allSteps = WALKTHROUGHS.flatMap((walkthrough) => walkthrough.steps);

describe('WALKTHROUGHS', () => {
  /*
    The load-bearing test. Without it a renamed marker turns its step into a
    centered card that reads as if it were designed that way, and nothing fails.
  */
  it('names only targets that exist as markers in a component', () => {
    const markers = declaredMarkers();
    const missing = allSteps
      .map((step) => step.target)
      .filter((target): target is string => Boolean(target))
      .filter((target) => !markers.has(target));
    expect(missing).toEqual([]);
  });

  it('gives every step a unique id', () => {
    const ids = allSteps.map((step) => step.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('gives every walkthrough a unique id', () => {
    const ids = WALKTHROUGHS.map((walkthrough) => walkthrough.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('gives every step something to say', () => {
    for (const step of allSteps) {
      expect(step.title.length).toBeGreaterThan(0);
      expect(step.body.length).toBeGreaterThan(0);
    }
  });

  /*
    Triggers are the one way an agent runs with nobody watching, so the flow
    that explains how an agent is configured has to reach them. Order matters
    as much as presence: the steps walk down the panel, and a trigger step
    after Save would point back up at a field the tour had already left.
  */
  it('covers triggers while walking down the agent panel', () => {
    const steps = WALKTHROUGHS.find((walkthrough) => walkthrough.id === 'create-agent')?.steps ?? [];
    const at = (target: string) => steps.findIndex((step) => step.target === target);

    expect(at('agent-triggers')).toBeGreaterThan(at('agent-tools'));
    expect(at('agent-triggers')).toBeLessThan(at('agent-save'));
  });

  it('opens with a step about the whole screen', () => {
    const overview = WALKTHROUGHS[0];
    expect(overview?.id).toBe('overview');
    const firstStep = overview?.steps[0];
    expect(firstStep).toBeDefined();
    expect(firstStep?.target).toBeUndefined();
  });
});
