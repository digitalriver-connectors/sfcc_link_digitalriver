/* global process, __dirname */

const glob = require("glob");
const path = require("path");
const chalk = require("chalk");
const minimatch = require("minimatch");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const CssMinimizerPlugin = require("css-minimizer-webpack-plugin");
const { CleanWebpackPlugin } = require("clean-webpack-plugin");
const TerserPlugin = require("terser-webpack-plugin");
const autoprefixer = require("autoprefixer");
const pkg = require("./package.json");
const webpack = require("webpack");

/** @module webpack.config */

/**
 * @constructor
 */
class MiniCssExtractPluginCleanup {
    apply(compiler) {
        compiler.hooks.compilation.tap("MiniCssExtractPluginCleanup", (compilation) => {
            compilation.hooks.afterProcessAssets.tap("MiniCssExtractPluginCleanup", () => {
                Object.keys(compilation.assets)
                    .filter((asset) => {
                        return ["*/css/**/*.js", "*/css/**/*.js.map"].some((pattern) => {
                            return minimatch(asset, pattern);
                        });
                    })
                    .forEach((asset) => {
                        delete compilation.assets[asset];
                    });
            });
        });
    }
}

/**
 * @function
 * @private
 * @param {Object} env
 * @param {String} cartridge
 * @returns {Object}
 */
function getJSBundle(env, cartridge) {
    const clientPath = path.resolve(__dirname, "cartridges", cartridge, "cartridge/client");

    const bundle = {};

    if (env.production) {
        bundle.mode = "production";
    } else {
        bundle.mode = "development";
    }

    bundle.entry = {};
    bundle.name = "js";

    let entries = glob.sync(path.resolve(clientPath, "*", "js", "*.js").replace(/\\/g, '/'));

    entries = entries.concat(glob.sync(path.resolve(clientPath, "*", "js", "experience", "**", "*.js").replace(/\\/g, '/')));
    entries.forEach((f) => {
        const key = path.join(path.dirname(path.relative(clientPath, f)), path.basename(f, ".js"));
        bundle.entry[key] = f;
    });

    const packagePath = path.resolve(__dirname, "package.json");
    const packageJson = require(packagePath);
    const clientJSFolder = "cartridge/client/default/js"

    bundle.resolve = {
        alias: {
          'base': path.resolve(__dirname, packageJson.paths.base, clientJSFolder),
          'dr_sfra': path.resolve(__dirname, packageJson.paths.dr_sfra, clientJSFolder),
          'dr_customer_credit': path.resolve(__dirname, packageJson.paths.dr_customer_credit, clientJSFolder)
        },
    };

    bundle.output = {
        path: path.resolve(__dirname, "cartridges", cartridge, "cartridge/static"),
        filename: "[name].js",
    };

    bundle.module = {
        rules: [
            {
                test: /\\.(js|jsx)$/,
                use: [
                    {
                        loader: "babel-loader",
                        options: {
                            compact: false,
                            babelrc: false,
                            cacheDirectory: true,
                            presets: ["@babel/preset-env"],
                            // See https://babeljs.io/docs/en/plugins-list
                            plugins: ["@babel/plugin-proposal-object-rest-spread"],
                            sourceType: "unambiguous"
                        },
                    },
                ],
            },
        ],
    };

    bundle.plugins = [
        new CleanWebpackPlugin({
            cleanOnceBeforeBuildPatterns: [path.resolve(__dirname, "cartridges", cartridge, "cartridge/static/*/js")],
            cleanAfterEveryBuildPatterns: [],
        }),
        (env.development || env.staging)
            ? new webpack.SourceMapDevToolPlugin()
            : null,
    ].filter(Boolean);

    bundle.optimization = {
        minimizer: [new TerserPlugin()]
    };

    return bundle;
}

/**
 * @function
 * @private
 * @param {Object} env
 * @param {String} cartridge
 * @returns {Object}
 */
function getCSSBundle(env, cartridge) {
    const clientPath = path.resolve(__dirname, "cartridges", cartridge, "cartridge/client");

    const bundle = {};

    if (env.production) {
        bundle.mode = "production";
    } else {
        bundle.mode = "development";
    }

    bundle.entry = {};
    bundle.name = "css";

    glob.sync(path.resolve(clientPath, "*", "scss", "**", "*.scss").replace(/\\/g, '/'))
        .filter((f) => !path.basename(f).startsWith("_"))
        .forEach((f) => {
            const key = path
                .join(path.dirname(path.relative(clientPath, f)), path.basename(f, ".scss"))
                .split(path.sep)
                .map((pPart, pIdx) => (pIdx === 1 && pPart === "scss" ? "css" : pPart))
                .join(path.sep);

            bundle.entry[key] = f;
        });

    bundle.output = {
        path: path.resolve(__dirname, "cartridges", cartridge, "cartridge/static"),
        filename: "[name].js",
    };

    bundle.module = {
        rules: [
            {
                test: /\.s[ac]ss$/i,
                use: [
                    { loader: MiniCssExtractPlugin.loader },
                    { loader: "css-loader", options: { url: false } },
                    {
                        loader: "postcss-loader",
                        options: {
                            postcssOptions: {
                                plugins: [autoprefixer],
                            },
                        },
                    },
                    {
                        loader: "sass-loader",
                        options: {
                            sassOptions: {
                                includePaths: [
                                    path.resolve(__dirname, "node_modules")
                                ]
                            },
                        }
                    },
                ],
            },
            {
                test: /\.css$/i,
                use: [
                    { loader: MiniCssExtractPlugin.loader },
                    { loader: "css-loader", options: { url: false } },
                    {
                        loader: "postcss-loader",
                        options: {
                            postcssOptions: {
                                plugins: [autoprefixer],
                            },
                        },
                    },
                ],
            },
        ],
    };

    bundle.plugins = [
        new CleanWebpackPlugin({
            cleanOnceBeforeBuildPatterns: [path.resolve(__dirname, "cartridges", cartridge, "cartridge/static/*/css")],
            cleanAfterEveryBuildPatterns: [],
        }),
        new MiniCssExtractPlugin(),
        new MiniCssExtractPluginCleanup(),
        (env.development || env.staging)
            ? new webpack.SourceMapDevToolPlugin()
            : null,
    ].filter(Boolean);

    bundle.optimization = {
        minimizer: [
            new CssMinimizerPlugin({
                minimizerOptions: {
                    preset: [
                        "default",
                        {
                            discardComments: { removeAll: true },
                        },
                    ],
                },
            }),
        ],
    };

    return bundle;
}

/**
 * @param {*} env
 * @param {*} _argv
 * @returns {Array<Object>}
 */
module.exports = (env, _argv) => {
    if (!pkg.cartridges) {
        console.error(`${chalk.red.bold("[ERROR] \u2716")} package.json does not contain the "cartridges" entry!`);
        process.exit(1);
    }

    const task = env?.compile || "all";
    const configurations = [];

    if (task === "all" || task === "js") {
        pkg.cartridges.forEach((cartridge) => {
            configurations.push(getJSBundle(env, cartridge));
        });
    }

    if (task === "all" || task === "scss") {
        pkg.cartridges.forEach((cartridge) => {
            configurations.push(getCSSBundle(env, cartridge));
        });
    }

    return configurations;
};
