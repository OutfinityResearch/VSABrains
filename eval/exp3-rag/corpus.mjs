export const testCorpus = [
  {
    docId: 'spec-auth-v1',
    version: '1.0',
    text: `
      Session tokens expire after 30 minutes of inactivity.
      Maximum session duration is 8 hours.
      Tokens are stored in HttpOnly cookies.
    `
  },
  {
    docId: 'spec-auth-v2',
    version: '2.0',
    text: `
      Session tokens expire after 15 minutes of inactivity.
      Maximum session duration is 24 hours.
      Tokens are stored in HttpOnly cookies with SameSite=Strict.
    `
  }
];

export const manualFacts = [
  {
    subject: 'session_token',
    predicate: 'expires_after',
    object: '30 minutes',
    qualifiers: { version: '1.0' },
    span: { start: 0, end: 0 },
    source: { docId: 'spec-auth-v1', chunkId: 'c1' }
  },
  {
    subject: 'session_token',
    predicate: 'expires_after',
    object: '15 minutes',
    qualifiers: { version: '2.0' },
    span: { start: 0, end: 0 },
    source: { docId: 'spec-auth-v2', chunkId: 'c2' }
  }
];

export const predicateVocabulary = {
  expires_after: { argTypes: ['entity', 'duration'] }
};
