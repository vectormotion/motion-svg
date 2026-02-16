import type { Bundle } from '../types';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validate a bundle JSON string or object.
 * Returns a list of errors (empty = valid).
 */
export function validateBundle(input: string | Bundle): ValidationResult {
  const errors: string[] = [];

  let bundle: Bundle;
  if (typeof input === 'string') {
    try {
      bundle = JSON.parse(input);
    } catch {
      return { valid: false, errors: ['Invalid JSON string.'] };
    }
  } else {
    bundle = input;
  }

  // Version
  if (!bundle.version) {
    errors.push('Missing "version" field.');
  }

  // Scene
  if (!bundle.scene) {
    errors.push('Missing "scene" field.');
  } else {
    if (!bundle.scene.viewBox) errors.push('Missing "scene.viewBox".');
    if (!bundle.scene.svg && (!bundle.scene.paths || bundle.scene.paths.length === 0)) {
      errors.push('Scene must have either "svg" or "paths".');
    }
  }

  // Actors
  if (!bundle.actors || !Array.isArray(bundle.actors)) {
    errors.push('Missing or invalid "actors" array.');
  } else {
    bundle.actors.forEach((a, i) => {
      if (!a.id) errors.push(`Actor[${i}] missing "id".`);
      if (!a.pathIds || a.pathIds.length === 0) errors.push(`Actor[${i}] has no pathIds.`);
      if (!a.origin) errors.push(`Actor[${i}] missing "origin".`);
    });
  }

  // Timelines
  if (!bundle.timelines || !Array.isArray(bundle.timelines)) {
    errors.push('Missing or invalid "timelines" array.');
  } else {
    bundle.timelines.forEach((t, i) => {
      if (!t.actorId) errors.push(`Timeline[${i}] missing "actorId".`);
      if (!t.keyframes || t.keyframes.length === 0) {
        errors.push(`Timeline[${i}] has no keyframes.`);
      } else {
        t.keyframes.forEach((kf, j) => {
          if (kf.at === undefined || kf.at === null) {
            errors.push(`Timeline[${i}].keyframes[${j}] missing "at".`);
          }
        });
      }
    });
  }

  // Triggers (optional)
  if (bundle.triggers && !Array.isArray(bundle.triggers)) {
    errors.push('"triggers" must be an array.');
  }

  // Variants (optional)
  if (bundle.variants !== undefined) {
    if (!Array.isArray(bundle.variants)) {
      errors.push('"variants" must be an array.');
    } else {
      const variantNames = new Set<string>();
      const actorIds = new Set((bundle.actors ?? []).map((a) => a.id));
      const timelineCount = (bundle.timelines ?? []).length;
      const triggerCount = (bundle.triggers ?? []).length;

      bundle.variants.forEach((v, i) => {
        if (!v.name || typeof v.name !== 'string') {
          errors.push(`Variant[${i}] missing or invalid "name".`);
        } else if (variantNames.has(v.name)) {
          errors.push(`Variant[${i}] duplicate name "${v.name}".`);
        } else {
          variantNames.add(v.name);
        }

        // Validate actorIds reference existing actors
        if (v.actorIds) {
          v.actorIds.forEach((aid) => {
            if (!actorIds.has(aid)) {
              errors.push(`Variant[${i}] ("${v.name}") references unknown actor "${aid}".`);
            }
          });
        }

        // Validate timelineIndices are in range
        if (!Array.isArray(v.timelineIndices)) {
          errors.push(`Variant[${i}] ("${v.name}") missing "timelineIndices".`);
        } else {
          v.timelineIndices.forEach((idx) => {
            if (idx < 0 || idx >= timelineCount) {
              errors.push(`Variant[${i}] ("${v.name}") timelineIndex ${idx} out of range (0..${timelineCount - 1}).`);
            }
          });
        }

        // Validate triggerIndices are in range
        if (!Array.isArray(v.triggerIndices)) {
          errors.push(`Variant[${i}] ("${v.name}") missing "triggerIndices".`);
        } else {
          v.triggerIndices.forEach((idx) => {
            if (idx < 0 || idx >= triggerCount) {
              errors.push(`Variant[${i}] ("${v.name}") triggerIndex ${idx} out of range (0..${triggerCount - 1}).`);
            }
          });
        }
      });
    }
  }

  return { valid: errors.length === 0, errors };
}
