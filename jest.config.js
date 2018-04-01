module.exports = {
	collectCoverageFrom: [
		"**/src/**/*.ts",
		"**/src/*.ts",
		"!**/src/config/passport.ts",
		"!**/src/types/*.ts",
		"!**/src/app.ts",
		"!**/src/server.ts"
	],
	globals: {
		'ts-jest': {
			tsConfigFile: 'tsconfig.json'
		}
	},
	moduleFileExtensions: [
		'ts',
		'js'
	],
	transform: {
		'^.+\\.(ts|tsx)$': './node_modules/ts-jest/preprocessor.js'
	},
	testMatch: [
		'**/test/**/*.test.(ts|js)'
	],
	testEnvironment: 'node'
};