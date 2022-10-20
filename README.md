# lambda-build-js

NPM package to build node.js AWS lambda functions.

# Get Started

## Install

```bash
yarn install @mietz-gmbh/lambda-build-js
```

## Build Lambda

```bash
yarn build-lambda [function_name] [--logging] [--watch] [--loggingLevel=[debug|info|warn|error]]
```

| flag             |default| description                                                                                                                         |
|------------------|---|-------------------------------------------------------------------------------------------------------------------------------------|
| `--logging`      |`false`| enable logging                                                                                                                      |
| `--watch`        |`false`| enable watch mode                                                                                                                   |
| `--loggingLevel` |`debug`| sets the logging level</br></br>**you must enable logging for this option to work!**</br></br>valid values are: `debug` `info` `warn` `error` |
| `--minimizeOff`  | `false` | disable minimization of the output bundle |

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
