module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // Enforce lowercase type (feat, fix, etc.)
    'type-case': [2, 'always', 'lower-case'],
    // Enforce non-empty subject
    'subject-empty': [2, 'never'],
    // Relax subject-case so capitalized subjects (e.g. "fix: Resolve...") are accepted
    'subject-case': [0],
    // Relax trailing period rule
    'subject-full-stop': [0],
    // Enforce non-empty type
    'type-empty': [2, 'never'],
    // Increase header max length to 125
    'header-max-length': [2, 'always', 125],
    // Allow these types only
    'type-enum': [
      2,
      'always',
      [
        'feat',     // New feature                    → minor bump
        'fix',      // Bug fix                        → patch bump
        'docs',     // Documentation only
        'style',    // Formatting, missing semicolons
        'refactor', // Code change that neither fixes a bug nor adds a feature
        'perf',     // Performance improvement
        'test',     // Adding missing tests
        'build',    // Build system or external deps
        'ci',       // CI configuration
        'chore',    // Other changes (don't modify src or test)
        'revert',   // Reverts a previous commit
      ],
    ],
  },
  // Automatically ignore merge commits from git and GitHub PR merges
  ignores: [(commit) => commit.startsWith('Merge ') || commit.startsWith('merge ')],
  defaultIgnores: true,
};
