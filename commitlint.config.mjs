/** @type {import('@commitlint/types').UserConfig} */
const config = {
  rules: {
    // Require a non-empty commit message. No type/scope convention enforced —
    // any plain sentence is accepted.
    'header-min-length': [2, 'always', 1],
    'header-max-length': [2, 'always', 100],
  },
};

export default config;
