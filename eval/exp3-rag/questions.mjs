export const allQuestions = [
  {
    question: 'How long before session tokens expire from inactivity in v2.0?',
    expectedVerdict: 'supported',
    expectedAnswer: '15 minutes',
    plan: {
      version: '2.0',
      subjects: ['session_token'],
      predicates: ['expires_after']
    }
  },
  {
    question: 'What encryption algorithm is used for tokens?',
    expectedVerdict: 'unsupported',
    expectedAnswer: null,
    plan: {
      subjects: ['session_token'],
      predicates: ['encryption_algorithm']
    }
  },
  {
    question: 'Can session tokens be stored in localStorage?',
    expectedVerdict: 'unsupported',
    expectedAnswer: null,
    plan: {
      subjects: ['session_token'],
      predicates: ['storage_location']
    }
  },
  {
    question: 'How long before session tokens expire from inactivity?',
    expectedVerdict: 'conflicting',
    expectedAnswer: null,
    plan: {
      subjects: ['session_token'],
      predicates: ['expires_after']
    }
  },
  {
    question: 'If a user is inactive for 20 minutes in v2.0, is their session valid?',
    expectedVerdict: 'supported',
    expectedAnswer: 'No',
    plan: {
      version: '2.0',
      subjects: ['session_token'],
      predicates: ['expires_after'],
      params: { inactivityMinutes: 20 }
    }
  }
];

export function categorizeQuestions(questions) {
  const categorized = {
    supported: [],
    unsupported: [],
    adversarial: [],
    conflicting: [],
    multihop: []
  };

  for (const q of questions) {
    if (q.expectedVerdict === 'supported') categorized.supported.push(q);
    else if (q.expectedVerdict === 'unsupported') {
      if (q.question.includes('localStorage')) categorized.adversarial.push(q);
      else categorized.unsupported.push(q);
    }
    else if (q.expectedVerdict === 'conflicting') categorized.conflicting.push(q);
  }

  categorized.multihop = categorized.supported.filter((q) => q.plan?.params?.inactivityMinutes != null);
  return categorized;
}
