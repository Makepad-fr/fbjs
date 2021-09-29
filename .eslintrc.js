module.exports = {
    root: true,
    parser: '@typescript-eslint/parser',
    plugins: [
      '@typescript-eslint',
    ],
    parserOptions: {
        project: './tsconfig.json',
    },
    rules: {
        "import/extensions": [
            "error",
            "ignorePackages",
            {
                "js": "never",
                "jsx": "never",
                "ts": "never",
                "tsx": "never"
            }
        ]
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
