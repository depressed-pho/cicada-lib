import fancyLog from "fancy-log";
import gulp from "gulp";
import merge from "merge2";
import ts from "gulp-typescript";
import npmWhich from "npm-which";
import { execFile } from "node:child_process";
import * as path from "node:path";
import { Writable } from "node:stream";
import { promisify } from "node:util";
import { mkdir, rm } from "node:fs/promises";

const which = npmWhich(process.cwd());

class CompileProtobuf extends Writable {
    #destDir;
    #protoc;

    constructor(destDir) {
        super({objectMode: true});
        this.#destDir = destDir;
        this.#protoc  = null;
    }

    _write(vinyl, _enc, cb) {
        this.#compile(vinyl)
            .then(() => cb(), e => { console.error(e); cb(e) });
    }

    async #compile(vinyl) {
        if (this.#protoc == null) {
            this.#protoc = await promisify(which)("protoc");
        }

        const destDir = path.resolve(this.#destDir, path.dirname(vinyl.relative));
        await mkdir(destDir, {recursive: true});

        const { stdout, stderr } = await promisify(execFile)(
            this.#protoc, [
                "--ts_out", destDir,
                "--ts_opt", "add_pb_suffix",
                "--ts_opt", "long_type_string", // Bedrock doesn't support bigints
                "--ts_opt", "output_javascript_es2020",
                "--ts_opt", "ts_nocheck",
                "--proto_path", path.dirname(vinyl.path),
                vinyl.path
            ]);
        if (stderr != "") {
            fancyLog.warn(stderr);
        }
        if (stdout != "") {
            fancyLog.info(stdout);
        }
    }
}

export async function clean() {
    await rm("dist", {force: true, recursive: true});
}

const tsProject = ts.createProject("tsconfig.json");
export const build =
    gulp.series(
        clean,
        function protoc() {
            return gulp.src("**/*.proto", {cwd: "lib", cwdbase: true})
                .pipe(new CompileProtobuf("dist"));
        },
        function transpile() {
            const tsResult = gulp.src("lib/**/*.ts", {sourcemaps: true})
                  .pipe(tsProject());

            return merge([
                tsResult.dts.pipe(gulp.dest("dist")),
                tsResult.js.pipe(gulp.dest("dist", {sourcemaps: "."}))
            ]);
        });

export function watch() {
    gulp.watch([
        "lib/**",
        "package.json",
        "tsconfig.json"
    ], {ignoreInitial: false}, build);
}

export default build;
