export const transitionRules = [
  {
    name: 'dead_cannot_act',
    check(prev, event) {
      const subject = event.resolvedSubject ?? event.subject;
      const alive = prev.entities?.[subject]?.alive ?? true;
      const action = event.action;
      const isAct = ['move', 'pick', 'drop', 'MOVE', 'PICK', 'DROP'].includes(action);
      if (alive === false && isAct && action !== 'REVIVE') {
        return { valid: false, reason: `${subject} is dead and cannot ${action}` };
      }
      return { valid: true };
    }
  }
];
