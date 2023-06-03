import gulp from "gulp";
import merge from "merge2";
import ts from "gulp-typescript";
import { rm } from "node:fs/promises";

export async function clean() {
    await rm("dist", {force: true, recursive: true});
}

const tsProject = ts.createProject("tsconfig.json");
export const build =
    gulp.series(
        clean,
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
