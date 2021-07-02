module.exports = {
    root: true,
    parser: '@typescript-eslint/parser',
    plugins: [
      '@typescript-eslint',
    ],
    parserOptions: {
        project: './tsconfig.json',
    },
    extends: [
        'airbnb-typescript',
    ],
    rules: {
        'no-console': 0
    }
};