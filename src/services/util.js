import {readFile, open} from "fs/promises";
import path, {dirname} from "path";
import $rdf, {Namespace} from "rdflib";
import Parser from "n3";

import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const basePath = path.resolve(__dirname, '..', '..');

async function parsePaths(pathsPath) {
    const contents = await readFile(path.resolve(basePath, pathsPath), 'utf8');
    const mimeType = 'text/turtle'
    const store = $rdf.graph()
    const GPS = Namespace("http://josd.github.io/eye/reasoning/gps/gps-schema#")
    $rdf.parse(contents, store, `file://${pathsPath}`, mimeType)
    const paths = store.match(undefined, GPS('path'), undefined).map(t => t.object);
    const steps = {};
    for (const pathList of paths) {
        const stepList = pathList.elements[0].elements;
        for (const step of stepList) {
            if (step.elements && step.elements[0].value === 'unorderedList') {
                for (const nestedStep of step.elements[1].elements) {
                    steps[nestedStep.value] = nestedStep;
                }
            } else {
                steps[step.value] = step;
            }
        }
    }
    return Object.values(steps);
}


async function validateTtl(ttlPath) {
    const parser = new Parser.Parser();
    const fd = await open(ttlPath);
    const rdfStream = fd.createReadStream();

    return new Promise((resolve, reject) => {

        parser.parse(rdfStream, function (error, triple, prefixes) {
            if (error) {
                reject(new Error(`${ttlPath} is an invalid Turtle document: ${e_read.message}`));
            }
        });
        resolve();
    });
}

export {parsePaths, validateTtl, basePath};
