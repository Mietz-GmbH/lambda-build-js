#! /usr/bin/env node

const webpack = require('webpack');
const TerserPlugin = require('terser-webpack-plugin');
const {resolve} = require('path');
const yazl = require('yazl');
const MemoryFileSystem = require('memory-fs');
const {createWriteStream, writeFileSync, mkdirSync, readFileSync, readdirSync} = require('fs');

function usage() {
    console.error('Usage: node build.js [function_name] [--logging] [--watch] [--loggingLevel=[debug|info|warn|error]]');
    process.exit(1);
}

const rootDir = resolve(__dirname, '../../../')
const functionsDir = resolve(rootDir, 'src/functions')

const defaultBuildConfig = {
    alias: {},
    externals: []
}

let buildConfig

try {
    buildConfig = {
        ...defaultBuildConfig,
        ...require(resolve(rootDir, "lambda-build.config.js"))
    };

} catch (error) {
    console.info('Cannot find "lambda-build.config.js"! Using default config.')
    buildConfig = defaultBuildConfig;
}

function handleCompilation(fileSystem, functionName, metadata) {
    const startTime = performance.now()
    const functionCode = fileSystem.readFileSync(`/${functionName}.js`);

    const outputDirectory = resolve(rootDir, 'dist');
    try {
        mkdirSync(outputDirectory);
    } catch (e) {
    }
    const zipFile = new yazl.ZipFile();
    zipFile.outputStream.pipe(createWriteStream(resolve(outputDirectory, `${functionName}.zip`)));
    zipFile.addBuffer(functionCode, 'lambda.js');
    zipFile.end();

    writeFileSync(resolve(outputDirectory, `${functionName}.json`), JSON.stringify(metadata));
    const endTime = performance.now()
    console.log(`Compressed "${functionName}" in ${Math.floor(endTime - startTime)}ms`);
}

async function buildFunctions(functionNames, logging, watch, loggingLevel) {
    const entry = {};
    functionNames.forEach((functionName) => {
        entry[functionName] = resolve(functionsDir, functionName);
    });

    const compiler = webpack({
        mode: 'production',
        entry,
        output: {
            path: '/',
            filename: `[name].js`,
            libraryTarget: 'commonjs',
        },
        resolve: {
            extensions: ['.ts', '.js'],
            alias: buildConfig.alias,
        },
        node: {
            __dirname: false,
        },
        module: {
            rules: [
                {
                    test: /\.(js|ts)$/,
                    loader: 'babel-loader',
                    exclude: /node_modules/,
                    options: {
                        presets: ['@babel/preset-typescript']
                    }
                },
            ],
        },
        target: 'node',
        externalsPresets: {node: true},
        externals: buildConfig.externals,
        plugins: [
            new webpack.DefinePlugin({
                'process.env.LOGGING': JSON.stringify(logging),
            }),
        ],
        optimization: {
            minimizer: [
                new TerserPlugin({
                    terserOptions: {
                        compress: {
                            pure_funcs: resolveLoggingLevelToPureFuncs(logging ? loggingLevel : ''),
                        },
                    },
                }),
            ],
        },
    });
    const fileSystem = new MemoryFileSystem();
    compiler.outputFileSystem = fileSystem;

    if (watch) {
        console.log('Start watching...');
        compiler.watch({}, (err, stats) => {
            if (err) {
                console.error('Failed to compile', err);
            } else {
                console.log(stats.toString({colors: true}));
                functionNames.map(functionName => {
                    const metadataFile = resolve(functionsDir, `${functionName}.json`);
                    return handleCompilation(fileSystem, functionName, JSON.parse(readFileSync(metadataFile, 'utf-8')));
                });
            }
        });
    } else {
        const stats = await new Promise(
            (resolve, reject) => compiler.run((err, stats) => err ? reject(err) : resolve(stats)));
        console.log(stats.toString({colors: true}));
        functionNames.map(functionName => {
            const metadataFile = resolve(functionsDir, `${functionName}.json`);
            const metadata = require(metadataFile);
            return handleCompilation(fileSystem, functionName, metadata);
        })
        compiler.close((err) => {
            if (err) console.error(err)
        });
    }
}

const loggingLevels = ['debug', 'info', 'warn', 'error'];

const resolveLoggingLevelToPureFuncs = (loggingLevel) => {
    switch (loggingLevel) {
        case 'debug':
            return [];
        case 'info':
            return ['console.debug', 'console.log'];
        case 'warn':
            return [...resolveLoggingLevelToPureFuncs('info'), 'console.info'];
        case 'error':
            return [...resolveLoggingLevelToPureFuncs('warn'), 'console.warn'];
        default:
            return [...resolveLoggingLevelToPureFuncs('error'), 'console.error'];
    }
}


async function build() {
    const [, , ...args] = process.argv;

    let functionName;
    let logging = false;
    let watch = false;
    let loggingLevel;

    for (const arg of args) {
        if (arg === '--logging') {
            logging = true;
        } else if (arg === '--watch') {
            watch = true;
        } else if (arg.startsWith('--loggingLevel=') && loggingLevels.includes(arg.split('=')[1])) {
            loggingLevel = arg.split('=')[1];
        } else if (!functionName) {
            functionName = arg;
        } else {
            usage();
        }
    }

    if (logging && !loggingLevel) {
        loggingLevel = 'debug';
        console.info('Logging level is set to "debug".');
    } else if (!logging && loggingLevel) {
        console.warn(`Ignoring logging level "${loggingLevel}" because logging is disabled.`);
    } else if (logging && loggingLevel) {
        console.info(`Logging level is set to "${loggingLevel}".`);
    }

    if (functionName) {
        await buildFunctions([functionName], logging, watch, loggingLevel);
    } else {
        const functionNames = readdirSync(functionsDir)
            .filter(filename => filename.endsWith('.json'))
            .map(filename => filename.substring(0, filename.length - 5));
        console.log('Building all functions', functionNames);
        await buildFunctions(functionNames, logging, watch, loggingLevel);
    }
}

build()
    .then(() => console.log('Compilation done.'))
    .catch(reason => console.error('Could not build function(s)', reason));
