import {readFile, open} from "fs/promises";
import path, {dirname} from "path";
import $rdf, {Namespace} from "rdflib";
import {Parser, Store} from "n3";

import { fileURLToPath } from 'url';
import {NamedNode} from "n3/lib/N3DataFactory.js";

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
    const contents = await readFile(ttlPath, 'utf-8');
    const parser = new Parser();
    return new Store(parser.parse(contents));
}

/**
 * Give name and description of a Step
 * @param stepNode {NamedNode}
 * @param n3store {Store} The RDF store where all steps are described.
 * @returns {String} A printable version of the step.
 */
function formatStep(stepNode, n3store) {
    // get short step name (last part in URI)
    const id = stepNode.id()

    // get description of step
    const descriptionNode = n3store.getObjects(stepNode, new NamedNode('https://fast.ilabt.imec.be/ns/oslo-steps/0.2#hasDescription'))[0];
    const description = n3store.getObjects(descriptionNode, new NamedNode('http://www.w3.org/2008/05/skos-xl#literalForm'))[0].value;

    return `${id}: ${description}`;
}

export {parsePaths, validateTtl, basePath, formatStep};
