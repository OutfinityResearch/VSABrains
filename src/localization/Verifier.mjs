/**
 * Consistency verification for transitions and localization candidates.
 * 
 * DS004 §6.3: Replay-based verification scores candidates by replaying
 * displacement over the token window and checking GridMap contents.
 */
export class Verifier {
  /**
   * @param {Array<{name: string, check: Function}>} transitionRules - Transition rules
   * @param {object} options - Configuration options
   * @param {Array} options.columns - Column instances for replay verification
   */
  constructor(transitionRules = [], options = {}) {
    this.transitionRules = transitionRules;
    this.columns = options.columns ?? [];
  }

  /**
   * Set columns for replay verification (can be called after construction).
   */
  setColumns(columns) {
    this.columns = columns;
  }

  /** Check a single transition */
  checkTransition(prev, event, next) {
    const violations = [];
    for (const rule of this.transitionRules) {
      const result = rule.check(prev, event, next);
      if (!result?.valid) {
        violations.push({
          name: rule.name,
          reason: result?.reason ?? 'rule_violation'
        });
      }
    }
    return violations;
  }

  /** Check if transition sequence is valid (returns structured violations for auditability) */
  verify(stateSequence) {
    const violations = [];

    for (let i = 0; i < stateSequence.length; i++) {
      const { prev, event, next } = stateSequence[i];
      const stepViolations = this.checkTransition(prev, event, next);
      if (stepViolations.length > 0) {
        violations.push({ index: i, violations: stepViolations });
      }
    }

    return violations;
  }

  /** Score plausibility of state sequence */
  score(stateSequence) {
    if (!stateSequence || stateSequence.length === 0) return 1.0;
    const violations = this.verify(stateSequence);
    const total = stateSequence.length;
    return Math.max(0, 1 - violations.length / total);
  }

  /**
   * Score a localization candidate by replay verification.
   * 
   * DS004 §6.3: For each candidate location, replay displacement over
   * the windowStepTokens and check whether the expected tokens exist
   * in GridMap.readTopK() at each visited cell.
   * 
   * @param {object} candidate - Localization candidate {columnId, location, ...}
   * @param {number[]} windowStepTokens - Token window for replay
   * @returns {Promise<number>} Verified score in [0, 1]
   */
  async scoreCandidate(candidate, windowStepTokens) {
    if (!windowStepTokens || windowStepTokens.length === 0) return 0;

    // Find the column for this candidate
    const column = this.columns.find(c => c.id === candidate.columnId);
    if (!column) {
      // If no column found, fall back to using all columns and average
      if (this.columns.length === 0) return candidate.score ?? 0;

      let totalScore = 0;
      for (const col of this.columns) {
        totalScore += this._scoreWithColumn(col, candidate.location, windowStepTokens);
      }
      return totalScore / this.columns.length;
    }

    return this._scoreWithColumn(column, candidate.location, windowStepTokens);
  }

  /**
   * Score candidate using a specific column.
   * @private
   */
  _scoreWithColumn(column, startLocation, windowStepTokens) {
    // Use Column's simulateTrajectory if available
    if (typeof column.simulateTrajectory === 'function') {
      const trajectory = column.simulateTrajectory(startLocation, windowStepTokens);
      if (typeof column.verifyTrajectory === 'function') {
        return column.verifyTrajectory(trajectory);
      }
      // Fallback: manual verification
      return this._verifyTrajectoryManual(column, trajectory);
    }

    // Manual replay if Column doesn't have the method
    return this._manualReplayScore(column, startLocation, windowStepTokens);
  }

  /**
   * Manual trajectory verification against GridMap.
   * @private
   */
  _verifyTrajectoryManual(column, trajectory) {
    if (!trajectory || trajectory.length === 0) return 0;

    const map = column.fastMaps?.[column.indexMapId ?? 0] ?? column.fastMaps?.[0];
    if (!map) return 0;

    const k = column.mapConfig?.k ?? 4;
    let matches = 0;

    for (const { location, token } of trajectory) {
      const stored = map.readTopK(location.x, location.y, k);
      const storedTokenIds = stored.map(([id]) => id);

      if (storedTokenIds.includes(token)) {
        matches++;
      }
    }

    return matches / trajectory.length;
  }

  /**
   * Manual replay when Column doesn't have simulateTrajectory.
   * @private
   */
  _manualReplayScore(column, startLocation, tokens) {
    if (!column.displacementEncoder || !column.fastMaps) return 0;

    const map = column.fastMaps[column.indexMapId ?? 0] ?? column.fastMaps[0];
    if (!map) return 0;

    const mapConfig = column.mapConfig ?? { width: 64, height: 64 };
    const k = mapConfig.k ?? 4;

    let current = { ...startLocation };
    let matches = 0;
    const tempBuffer = [];
    const contextLength = column.displacementEncoder.contextLength ?? 2;

    for (const token of tokens) {
      // Check if token exists at current location
      const stored = map.readTopK(current.x, current.y, k);
      const storedTokenIds = stored.map(([id]) => id);
      if (storedTokenIds.includes(token)) {
        matches++;
      }

      // Update buffer and compute displacement
      tempBuffer.push(token);
      if (tempBuffer.length > contextLength) {
        tempBuffer.shift();
      }

      const displacement = column.displacementEncoder.encode(tempBuffer);
      current = column.displacementEncoder.apply(current, displacement, mapConfig);
    }

    return tokens.length > 0 ? matches / tokens.length : 0;
  }

  /**
   * Score multiple candidates and return ranked results.
   * 
   * @param {Array} candidates - Localization candidates
   * @param {number[]} windowStepTokens - Token window for replay
   * @returns {Promise<Array>} Candidates with verifiedScore, sorted by score
   */
  async scoreAndRankCandidates(candidates, windowStepTokens) {
    const scored = [];

    for (const candidate of candidates) {
      const verifiedScore = await this.scoreCandidate(candidate, windowStepTokens);
      scored.push({
        ...candidate,
        verifiedScore,
        combinedScore: (candidate.score + verifiedScore) / 2
      });
    }

    // Sort by combined score (index score + verified score)
    scored.sort((a, b) => b.combinedScore - a.combinedScore);
    return scored;
  }
}
