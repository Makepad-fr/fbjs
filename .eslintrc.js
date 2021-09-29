module.exports = {
    root: true,
    parser: '@typescript-eslint/parser',
    plugins: [
      '@typescript-eslint',
    ],
    parserOptions: {
        project: './tsconfig.json',
    },
    settings: {
        react: {
            version: "999.999.999"
        }
    },
    extends: [
        'airbnb-typescript',
    ],
    rules: {
        'no-console': 0
    }
};
