/**
 * Consistency verification for transitions.
 */
export class Verifier {
  constructor(transitionRules = []) {
    this.transitionRules = transitionRules;
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
}
