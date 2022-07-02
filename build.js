#! /usr/bin/env node

const webpack = require('webpack');
const TerserPlugin = require('terser-webpack-plugin');
const {resolve} = require('path');
const yazl = require('yazl');
const MemoryFileSystem = require('memory-fs');
const {createWriteStream, writeFileSync, mkdirSync, readFileSync, readdirSync} = require('fs');

function usage() {
    console.error('Usage: node build.js [function_name] [--logging] [--watch]');
    process.exit(1);
}

const rootDir = resolve(__dirname, '../../')
const functionsDir = resolve (rootDir, 'src/functions')

function handleCompilation(fileSystem, functionName, metadata) {
    const functionCode = fileSystem.readFileSync('/function.js');

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
}

async function buildFunction(functionName, logging, watch) {
    const metadataFile = resolve(functionsDir, `${functionName}.json`);
    const metadata = require(metadataFile);

    const compiler = webpack({
        mode: 'production',
        entry: resolve(functionsDir, `${functionName}`),
        output: {
            path: '/',
            filename: `function.js`,
            libraryTarget: 'commonjs',
        },
        resolve: {
            extensions: ['.ts', '.js'],
            alias: {
                pg: resolve(__dirname, 'pg.js'),
            },
        },
        node: {
            __dirname: false,
        },
        module: {
            rules: [
                {
                    test: /\.(js|ts)$/,
                    loader: 'babel-loader',
                },
            ],
        },
        target: 'node',
        externals: ['aws-sdk', ...(metadata.nodeExternals ?? [])],
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
                            drop_console: !logging,
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
                handleCompilation(fileSystem, functionName, JSON.parse(readFileSync(metadataFile, 'utf-8')));
            }
        });
    } else {
        const stats = await new Promise(
            (resolve, reject) => compiler.run((err, stats) => err ? reject(err) : resolve(stats)));
        console.log(stats.toString({colors: true}));
        handleCompilation(fileSystem, functionName, metadata);
    }
}

async function build() {
    const [, , ...args] = process.argv;

    let functionName;
    let logging = false;
    let watch = false;

    for (const arg of args) {
        if (arg === '--logging') {
            logging = true;
        } else if (arg === '--watch') {
            watch = true;
        } else if (!functionName) {
            functionName = arg;
        } else {
            usage();
        }
    }

    if (functionName) {
        await buildFunction(functionName, logging, watch);
    } else {
        const functionNames = readdirSync(functionsDir)
            .filter(filename => filename.endsWith('.json'))
            .map(filename => filename.substring(0, filename.length - 5));
        console.log('Building all functions', functionNames);
        await Promise.all(functionNames.map(functionName => buildFunction(functionName, logging, watch)));
    }
}

build()
    .then(() => console.log('Complication done.'))
    .catch(reason => console.error('Could not build function(s)', reason));
