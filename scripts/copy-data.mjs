import path from "path";
import fs from "fs";
import fsp from "fs/promises";

const ROOT_DIR = process.cwd();
const DATA_DIR = path.join(ROOT_DIR, "data");
const SERVER_DIR = path.join(ROOT_DIR, ".netlify");

main();

async function main() {
  let ensured = new Set();
  await copyFiles(DATA_DIR);
  console.log("All files copied");

  async function copyFiles(filePath) {
    let relativePath = path.relative(DATA_DIR, filePath);
    let files = await fsp.readdir(filePath);
    let promises = [];
    for (let file of files) {
      file = path.resolve(filePath, file);
      if (fs.lstatSync(file).isDirectory()) {
        let outDir = path.join(SERVER_DIR, "data", relativePath);
        if (!ensured.has(outDir)) {
          await ensureDir(outDir);
          ensured.add(outDir);
        }
        promises.push(copyFiles(file));
      } else {
        let contents = await fsp.readFile(file, "utf8");
        let outDir = path.join(SERVER_DIR, "data", relativePath);
        if (!ensured.has(outDir)) {
          await ensureDir(outDir);
          ensured.add(outDir);
        }
        promises.push(
          fsp.writeFile(path.join(outDir, path.basename(file)), contents)
        );
      }
    }
    await Promise.all(promises);
  }
}

async function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    try {
      await fsp.mkdir(dir);
    } catch (_) {}
  }
}
