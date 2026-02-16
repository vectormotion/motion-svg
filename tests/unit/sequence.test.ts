import { describe, it, expect } from 'vitest';
import { sequence, stagger, parallelDuration } from '../../src/timeline/sequence';
import { timeline } from '../../src/timeline/timeline';
import type { Actor, Timeline } from '../../src/types';

function makeActor(id: string): Actor {
  return {
    id,
    pathIds: ['p1'],
    paths: [{ id: 'p1', d: 'M0,0 L10,10' }],
    origin: { x: 0, y: 0 },
    position: { x: 0, y: 0 },
    scale: 1,
    rotation: 0,
    opacity: 1,
    blurRadius: 0,
    backdropBlur: 0,
    z: 0,
  };
}

function makeTl(actor: Actor, duration: number): Timeline {
  return timeline(actor, {
    keyframes: [
      { at: 0, opacity: 0 },
      { at: duration, opacity: 1, curve: 'linear' },
    ],
  });
}

describe('sequence', () => {
  const actor = makeActor('seq-actor');

  it('chains timelines sequentially', () => {
    const tl1 = makeTl(actor, 500);
    const tl2 = makeTl(actor, 300);
    const tl3 = makeTl(actor, 200);

    const result = sequence(actor, {
      items: [{ timeline: tl1 }, { timeline: tl2 }, { timeline: tl3 }],
    });

    // tl1: 0–500, tl2: 500–800, tl3: 800–1000
    expect(result.duration).toBe(1000);
    expect(result.actorId).toBe('seq-actor');

    // Check keyframe offsets
    const ats = result.keyframes.map((kf) => kf.at);
    expect(ats).toContain(0);
    expect(ats).toContain(500);
    expect(ats).toContain(800);
    expect(ats).toContain(1000);
  });

  it('respects explicit offset', () => {
    const tl1 = makeTl(actor, 300);
    const tl2 = makeTl(actor, 200);

    const result = sequence(actor, {
      items: [
        { timeline: tl1 },
        { timeline: tl2, offset: 100 }, // starts at 100, not 300
      ],
    });

    // tl2 starts at offset 100, ends at 300
    expect(result.duration).toBe(300);
  });

  it('respects delay', () => {
    const tl1 = makeTl(actor, 200);
    const tl2 = makeTl(actor, 200);

    const result = sequence(actor, {
      items: [
        { timeline: tl1 },
        { timeline: tl2, delay: 100 }, // 100ms gap after tl1
      ],
    });

    // tl1: 0–200, gap 100, tl2: 300–500
    expect(result.duration).toBe(500);
  });

  it('handles single item', () => {
    const tl = makeTl(actor, 1000);
    const result = sequence(actor, { items: [{ timeline: tl }] });
    expect(result.duration).toBe(1000);
  });
});

describe('stagger', () => {
  it('creates staggered timelines with from=start', () => {
    const actors = [makeActor('a1'), makeActor('a2'), makeActor('a3'), makeActor('a4')];
    const keyframes = [
      { at: 0, opacity: 0 },
      { at: 400, opacity: 1, curve: 'linear' as const },
    ];

    const result = stagger({ actors, keyframes, stagger: 100, from: 'start' });

    expect(result).toHaveLength(4);
    // a1: 0–400, a2: 100–500, a3: 200–600, a4: 300–700
    expect(result[0].duration).toBe(400);
    expect(result[1].duration).toBe(500);
    expect(result[2].duration).toBe(600);
    expect(result[3].duration).toBe(700);
    expect(result[0].actorId).toBe('a1');
    expect(result[3].actorId).toBe('a4');
  });

  it('from=end reverses the order', () => {
    const actors = [makeActor('a1'), makeActor('a2'), makeActor('a3')];
    const keyframes = [{ at: 0, opacity: 0 }, { at: 200, opacity: 1 }];

    const result = stagger({ actors, keyframes, stagger: 100, from: 'end' });

    // a1 gets delay 2*100=200, a2 gets 1*100=100, a3 gets 0*100=0
    expect(result[0].duration).toBe(400); // a1: 200–400
    expect(result[1].duration).toBe(300); // a2: 100–300
    expect(result[2].duration).toBe(200); // a3: 0–200
  });

  it('from=center starts from center outwards', () => {
    const actors = [makeActor('a1'), makeActor('a2'), makeActor('a3'), makeActor('a4'), makeActor('a5')];
    const keyframes = [{ at: 0, scale: 0 }, { at: 100, scale: 1 }];

    const result = stagger({ actors, keyframes, stagger: 50, from: 'center' });

    // mid = 2, distances: [2, 1, 0, 1, 2]
    // delays: [100, 50, 0, 50, 100]
    expect(result[2].duration).toBe(100); // center, no delay
    expect(result[1].duration).toBe(150); // 50ms delay
    expect(result[3].duration).toBe(150); // 50ms delay
    expect(result[0].duration).toBe(200); // 100ms delay
    expect(result[4].duration).toBe(200); // 100ms delay
  });

  it('from=edges starts from edges inwards', () => {
    const actors = [makeActor('a1'), makeActor('a2'), makeActor('a3'), makeActor('a4'), makeActor('a5')];
    const keyframes = [{ at: 0, scale: 0 }, { at: 100, scale: 1 }];

    const result = stagger({ actors, keyframes, stagger: 50, from: 'edges' });

    // mid = 2, distances from center: [2, 1, 0, 1, 2]
    // edges order = mid - distance: [0, 1, 2, 1, 0]
    // delays: [0, 50, 100, 50, 0]
    expect(result[0].duration).toBe(100); // edge, no delay
    expect(result[4].duration).toBe(100); // edge, no delay
    expect(result[2].duration).toBe(200); // center, max delay
  });

  it('defaults from to start', () => {
    const actors = [makeActor('a1'), makeActor('a2')];
    const keyframes = [{ at: 0, opacity: 0 }, { at: 100, opacity: 1 }];

    const result = stagger({ actors, keyframes, stagger: 50 });

    expect(result[0].duration).toBe(100); // no delay
    expect(result[1].duration).toBe(150); // 50ms delay
  });

  it('handles single actor', () => {
    const actors = [makeActor('solo')];
    const keyframes = [{ at: 0, opacity: 0 }, { at: 500, opacity: 1 }];

    const result = stagger({ actors, keyframes, stagger: 100 });

    expect(result).toHaveLength(1);
    expect(result[0].duration).toBe(500);
    expect(result[0].actorId).toBe('solo');
  });

  it('handles 20 actors', () => {
    const actors = Array.from({ length: 20 }, (_, i) => makeActor(`a${i}`));
    const keyframes = [{ at: 0, opacity: 0 }, { at: 100, opacity: 1 }];

    const result = stagger({ actors, keyframes, stagger: 10, from: 'start' });

    expect(result).toHaveLength(20);
    // Last actor: delay = 19*10 = 190, duration = 190+100 = 290
    expect(result[19].duration).toBe(290);
  });

  it('produces standard Timeline objects compatible with the system', () => {
    const actors = [makeActor('a1'), makeActor('a2')];
    const keyframes = [{ at: 0, scale: 1 }, { at: 300, scale: 2 }];

    const result = stagger({ actors, keyframes, stagger: 100 });

    for (const tl of result) {
      expect(tl.id).toBeTruthy();
      expect(tl.actorId).toBeTruthy();
      expect(tl.keyframes.length).toBeGreaterThan(0);
      expect(tl.duration).toBeGreaterThan(0);
    }
  });
});

describe('parallelDuration', () => {
  it('returns max duration of multiple timelines', () => {
    const actor = makeActor('a');
    const tl1 = makeTl(actor, 500);
    const tl2 = makeTl(actor, 1200);
    const tl3 = makeTl(actor, 800);

    expect(parallelDuration([tl1, tl2, tl3])).toBe(1200);
  });

  it('returns 0 for empty array', () => {
    expect(parallelDuration([])).toBe(0);
  });

  it('returns the duration for a single timeline', () => {
    const actor = makeActor('a');
    const tl = makeTl(actor, 750);
    expect(parallelDuration([tl])).toBe(750);
  });
});
