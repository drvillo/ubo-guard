const nextJest = require('next/jest')

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files in your test environment
  dir: './',
})

// Add any custom config to be passed to Jest
const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'node', // Changed from jest-environment-jsdom to node for Next.js server code
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testMatch: ['**/test/**/*.test.ts', '**/test/**/*.test.tsx'],
  // Add transformIgnorePatterns to ensure Next.js and other packages are transformed
  transformIgnorePatterns: [
    'node_modules/(?!(.*\\.mjs$|next|@supabase))',
  ],
  // Add these for native module support
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  // Ensure native modules are not transformed
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      tsconfig: {
        module: 'commonjs',
      },
    }],
  },
}

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
module.exports = createJestConfig(customJestConfig)

