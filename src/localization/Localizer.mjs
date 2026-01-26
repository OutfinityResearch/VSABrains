import { unpackLocKey } from '../util/locKey.mjs';

/**
 * Top-K frame alignment from context window.
 */
export class Localizer {
  constructor(columns) {
    this.columns = columns;
  }

  /** Find candidate locations from token window */
  async localize(windowStepTokens, topK = 20, config = {}) {
    const candidates = [];
    const perColumnStats = [];

    for (const column of this.columns) {
      const result = this._localizeColumn(windowStepTokens, column, topK, config);
      if (config.debug) {
        candidates.push(...result.candidates);
        perColumnStats.push({ columnId: column.id, ...result.stats });
      } else {
        candidates.push(...result);
      }
    }

    candidates.sort((a, b) => (b.lastSeenMax ?? 0) - (a.lastSeenMax ?? 0) || b.score - a.score);
    const top = candidates.slice(0, topK);

    if (config.debug) {
      return {
        candidates: top,
        stats: { perColumn: perColumnStats }
      };
    }

    return top;
  }

  _localizeColumn(windowStepTokens, column, topK, config) {
    const locationIndex = column.locationIndex;
    const candidatesPerToken = config.candidatesPerToken ?? 50;
    const minMatchesRatio = config.minMatchesRatio ?? 0.6;
    const minMatches = Math.ceil(windowStepTokens.length * minMatchesRatio);

    const perToken = windowStepTokens.map((tok) => locationIndex.getCandidates(tok, candidatesPerToken));

    let anchorIdx = 0;
    for (let i = 1; i < perToken.length; i++) {
      if (perToken[i].length < perToken[anchorIdx].length) anchorIdx = i;
    }

    const byLocKey = new Map();
    for (const c of perToken[anchorIdx]) {
      byLocKey.set(c.locKey, { matches: 1, lastSeenMax: c.lastSeen });
    }

    for (let i = 0; i < perToken.length; i++) {
      if (i === anchorIdx) continue;
      for (const c of perToken[i]) {
        const entry = byLocKey.get(c.locKey);
        if (!entry) continue;
        entry.matches++;
        entry.lastSeenMax = Math.max(entry.lastSeenMax, c.lastSeen);
      }
    }

    const candidates = [];
    for (const [locKey, data] of byLocKey.entries()) {
      if (data.matches < minMatches) continue;
      const location = unpackLocKey(locKey);
      candidates.push({
        columnId: column.id,
        locKey,
        location,
        matches: data.matches,
        lastSeenMax: data.lastSeenMax,
        score: data.matches / windowStepTokens.length
      });
    }

    const merged = new Map();
    for (const c of candidates) merged.set(c.locKey, c);

    if (windowStepTokens.length > 0) {
      const lastToken = windowStepTokens[windowStepTokens.length - 1];
      const fallback = locationIndex.getCandidates(lastToken, candidatesPerToken)
        .map((c) => ({
          columnId: column.id,
          locKey: c.locKey,
          location: unpackLocKey(c.locKey),
          matches: 1,
          lastSeenMax: c.lastSeen,
          score: 1 / windowStepTokens.length
        }));

      for (const c of fallback) {
        const existing = merged.get(c.locKey);
        if (!existing || (c.lastSeenMax ?? 0) > (existing.lastSeenMax ?? 0)) {
          merged.set(c.locKey, c);
        }
      }
    }

    const combined = [...merged.values()];
    combined.sort((a, b) => (b.lastSeenMax ?? 0) - (a.lastSeenMax ?? 0) || b.score - a.score);
    const top = combined.slice(0, topK);

    if (config.debug) {
      return {
        candidates: top,
        stats: {
          perTokenCandidates: perToken.map((arr) => arr.length),
          anchorIdx,
          scoredLocations: combined.length
        }
      };
    }

    return top;
  }

  /** Score candidates by replay consistency */
  async scoreWithReplay(candidates, windowStepTokens, verifier) {
    if (!verifier) return candidates;

    const scored = [];
    for (const candidate of candidates) {
      let verifiedScore = null;
      if (typeof verifier.scoreCandidate === 'function') {
        verifiedScore = await verifier.scoreCandidate(candidate, windowStepTokens);
      } else if (typeof verifier.score === 'function' && candidate.stateSequence) {
        verifiedScore = verifier.score(candidate.stateSequence);
      }
      if (verifiedScore != null) {
        candidate.verifiedScore = verifiedScore;
      }
      scored.push(candidate);
    }

    return scored;
  }
}
