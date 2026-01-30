import { runtime } from '../store.js';
import { drawGrid } from './grid.js';

export function computeVotingFromColumns(columns, candidates) {
  if (!columns?.length || !candidates?.length) {
    return { votes: [], winnerIdx: -1, confidence: 0 };
  }

  // Each column "votes" for the candidate closest to its current position
  const votes = [];
  const voteScores = new Map();

  columns.forEach((col, idx) => {
    // Find best candidate for this column
    let bestCandidate = null;
    let bestScore = -Infinity;

    for (const cand of candidates) {
      // Score based on proximity and match score
      const dist = Math.hypot(col.x - cand.location.x, col.y - cand.location.y);
      const score = (cand.score ?? 1) - dist * 0.01;
      if (score > bestScore) {
        bestScore = score;
        bestCandidate = cand;
      }
    }

    if (bestCandidate) {
      const key = `${bestCandidate.location.x},${bestCandidate.location.y}`;
      voteScores.set(key, (voteScores.get(key) ?? 0) + 1);
      votes.push(1); // Each column contributes 1 vote
    } else {
      votes.push(0);
    }
  });

  // Find winner
  let winnerIdx = -1;
  let maxVotes = 0;
  let totalVotes = 0;

  columns.forEach((col, idx) => {
    if (votes[idx] > maxVotes) {
      maxVotes = votes[idx];
      winnerIdx = idx;
    }
    totalVotes += votes[idx];
  });

  // Confidence = majority / total
  const confidence = totalVotes > 0 ? maxVotes / totalVotes : 0;

  return { votes, winnerIdx, confidence };
}

export function updateVotingState(candidates, columns) {
  if (!candidates?.length || !columns?.length) {
    runtime.votingState = { votes: [], winnerIdx: -1, confidence: 0 };
    return;
  }

  const result = computeVotingFromColumns(columns, candidates);
  runtime.votingState = result;
}

export function setLocalizationCandidates(candidates) {
  runtime.localizationCandidates = candidates ?? [];
}

export function setTheoryVizEnabled(enabled) {
  runtime.showTheoryViz = enabled;
  drawGrid();
}

