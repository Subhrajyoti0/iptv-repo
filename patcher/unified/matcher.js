import { similarity } from "./utils.js";

export function scoreCandidate(source, target) {
  let score = 0;

  const nameScore = similarity(source.name, target.name);
  score += nameScore * 0.55;

  let qualityScore = 0.5;
  if (source.quality && target.quality) {
    qualityScore = source.quality === target.quality ? 1 : 0.25;
  }
  score += qualityScore * 0.15;

  let languageScore = 0.5;
  if (source.language && target.language) {
    languageScore =
      String(source.language).toLowerCase() === String(target.language).toLowerCase()
        ? 1
        : 0.25;
  }
  score += languageScore * 0.15;

  let groupScore = 0.5;
  if (source.group && target.group) {
    groupScore =
      String(source.group).toLowerCase() === String(target.group).toLowerCase()
        ? 1
        : 0.35;
  }
  score += groupScore * 0.15;

  return {
    score,
    detail: {
      nameScore,
      qualityScore,
      languageScore,
      groupScore
    }
  };
}

export function findBest(source, targets, threshold = 0.82) {
  let best = null;
  let bestScore = 0;
  let bestDetail = null;

  for (const target of targets) {
    const result = scoreCandidate(source, target);

    if (result.score > bestScore) {
      best = target;
      bestScore = result.score;
      bestDetail = result.detail;
    }
  }

  if (!best || bestScore < threshold) {
    return null;
  }

  return {
    best,
    score: bestScore,
    detail: bestDetail
  };
}
