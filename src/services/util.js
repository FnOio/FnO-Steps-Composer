import {readFile} from "fs/promises";
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
    let alternativesMap = new Map();  // map: first step => {cost, path} . Only the path with lowest cost is kept (per first steo)

    for (const pathList of paths) {
        const cost = parseInt(pathList.elements[1].value);  // what is the "cost" of this path?
        const path = [];    // An array of steps, forming the path
        const stepList = pathList.elements[0].elements;
        for (const step of stepList) {
            if (step.elements && step.elements[0].value === 'unorderedList') { // this means that these steps can be executed in any order (parallel)
                const parallelSteps = [];   // we put parallel steps into an array (no set!), because order is important to identify the "first" step in the path.
                for (const nestedStep of step.elements[1].elements) {
                    //console.log(` nested step: ${nestedStep.value}`);
                    steps[nestedStep.value] = nestedStep;
                    parallelSteps.push(nestedStep.value);
                    //path.push(nestedStep.value);
                }
                path.push(parallelSteps);
            } else {
                steps[step.value] = step;
                path.push([step.value]);    // a non-parallel step can be represented as an array of 1 step only
            }
        }

        if (path.length > 0) {
            // Add path to alternatives map if cost is lower than previous.
            // We take the last step as key, since that one will disappear lastly.
            const lastSteps = path[path.length - 1];
            const lastStep = lastSteps[lastSteps.length - 1];
            if (alternativesMap.has(lastStep)) {
                // check cost of existing path. Only add if new cost is lower
                const {cost: existingCost} = alternativesMap.get(lastStep);
                if (cost < existingCost) {
                    // replace the existing path
                    alternativesMap.set(lastStep, {cost: cost, path: path});
                }
            } else {
                alternativesMap.set(lastStep, {cost: cost, path: path});
            }
        }
    }

    alternativesMap = new Map([...alternativesMap.entries()].sort());   // sort map by entry (just for printing purposes ;) )

    return {steps: Object.values(steps), alternatives: alternativesMap};
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
    const id = stepNode.value.split('#')[1];

    // get description of step
    let description = "no description";
    const descriptionNodes = n3store.getObjects(stepNode, new NamedNode('https://w3id.org/imec/ns/fno-steps#hasDescription'));
    if (descriptionNodes.length > 0 ) {
        const descriptionNode = descriptionNodes[0];
        const descValueNodes = n3store.getObjects(descriptionNode, new NamedNode('http://www.w3.org/2008/05/skos-xl#literalForm'));
        if (descValueNodes.length > 0) {
            description = descValueNodes[0].value;
        }
    }
    return `${id} (${description})`;
}

/**
 * Return a String representation of a map with alternative steps
 * @param alternativesMap {Map<String, Array>} A map with alternative paths
 * @param n3Store {Store} The RDF store where all steps are described.
 * @param indent {Number} The indentation to format the resulting string
 * @returns The formatted string
 */
function formatAlternativeMap(alternativesMap, n3Store, indent = 0) {
    if (alternativesMap.size === 0) {
        return "";
    }
    const indentStr = " ".repeat(indent);
    let resultStr = "";
    let optionCounter = 1;
    for (const path of alternativesMap.values()) {
        if (alternativesMap.size > 1) {
            resultStr += `${indentStr}option ${optionCounter}:\n`;
        }
        let stepCounter = 1;
        for (const parallelSteps of path.path) {
            resultStr += `${indentStr}  ${stepCounter}) `;
            for (const step of parallelSteps) {
                const formattedStep = formatStep(new NamedNode(step), n3Store);
                resultStr += `${formattedStep} AND `;
            }
            resultStr = resultStr.slice(0, -5);
            resultStr += '\n';
            stepCounter++;
        }
        optionCounter++;
    }
    return resultStr;
}

/**
 * Format the data. If there is a rdfs:comment, use that. If not, print the predicates and objects.
 * @param dataStore {Store} The RDF store with data quads.
 */
function formatData(dataStore) {
    const commentNodes = dataStore.getObjects(null, new NamedNode("http://www.w3.org/2000/01/rdf-schema#comment"));
    if (commentNodes.length === 0) {
        return dataStore.toString();
    } else {
        return commentNodes[0].value;
    }
}

export {parsePaths, validateTtl, basePath, formatStep, formatAlternativeMap, formatData};
