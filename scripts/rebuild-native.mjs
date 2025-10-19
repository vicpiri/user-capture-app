#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import process from "node:process";

const args = new Set(process.argv.slice(2));
const getArgVal = (flag) => {
    const i = process.argv.indexOf(flag);
    return i >= 0 ? process.argv[i + 1] : undefined;
};

const withSharp = args.has("--with-sharp");
const pythonPath = getArgVal("--python");
const msvs = getArgVal("--msvs");

const run = (cmd, argv = [], opts = {}) => {
    const res = spawnSync(cmd, argv, { stdio: "inherit", shell: process.platform === "win32", ...opts });
    if (res.status !== 0) {
        console.error(`[rebuild] Command failed: ${cmd} ${argv.join(" ")}`);
        process.exit(res.status ?? 1);
    }
};

const require = createRequire(import.meta.url);

function detectElectronVersion() {
    try {
        const electronPkgPath = require.resolve("electron/package.json", { paths: [process.cwd()] });
        const electronPkg = require(electronPkgPath);
        return electronPkg.version;
    } catch {
        console.error("[rebuild] Electron not found in node_modules. Run `npm ci` first.");
        process.exit(1);
    }
}

function platformTarget() {
    return process.platform === "win32" ? "win32" : (process.platform === "darwin" ? "darwin" : "linux");
}

function main() {
    console.log("[rebuild] Detecting Electron version...");
    const electronVersion = detectElectronVersion();
    console.log(`[rebuild] Electron version: ${electronVersion}`);

    const env = { ...process.env };
    env.npm_config_target = electronVersion;
    env.npm_config_runtime = "electron";
    env.npm_config_disturl = "https://electronjs.org/headers";
    env.npm_config_build_from_source = "true";
    if (pythonPath) env.PYTHON = pythonPath;
    if (msvs && process.platform === "win32") env.msvs_version = msvs;

    console.log("[rebuild] Rebuilding sqlite3...");
    run("npm", ["rebuild", "sqlite3", "--build-from-source", "--verbose"], { env });

    if (withSharp) {
        console.log("[rebuild] Rebuilding sharp...");
        run("npm", ["rebuild", "sharp", "--build-from-source", "--verbose"], { env });
    }

    console.log("[rebuild] Aligning with electron-builder...");
    run("npx", ["-y", "electron-builder", "install-app-deps", `--platform=${platformTarget()}`], { env });

    console.log("[rebuild] Done.");
}

main();
