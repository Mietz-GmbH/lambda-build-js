# lambda-build-js
NPM package to build node.js AWS lambda functions.

# Get Started

## Install

```bash
yarn install @mietz-gmbh/lambda-build-js
```

## Build Lambda

```bash
yarn build-lambda [function_name] [--logging] [--watch]
```

# Configuration

Create a file called `lambda-build.config.js` with a default export (`module.exports`).

You can specify webpacks `alias` and `externals`.

```js
module.exports = {
  alias: {
    pg: 'pg.js'
  },
  externals: [
    'aws-sdk',
  ]
}
```
