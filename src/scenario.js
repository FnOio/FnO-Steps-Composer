/**
 * Runs a scenario
 * The input is a subdirectory of scenarios
 */

import {program} from "commander";
import {basePath} from "./services/util.js";
import path from 'path';
import {readFile, readdir} from "fs/promises";
import {reasonFlow} from "./services/flow-reasoning.js";
import {existsSync} from "node:fs";

await main();

async function main() {

    // parse command line arguments
    program
        .requiredOption('-s --scenario <name>', 'The scenario to run. It must be a subdirectory of `scenarios`');
    program.parse(process.argv);
    const options = program.opts();

    const scenario = options.scenario;
    console.log(`Running scenario "${scenario}"`);
    await _runScenario(scenario);
}

/**
 * Runs a scenario
 * @param {String} scenario The name of the scenario; it must be the name of a directory in the `scenarios` directory.
 * @returns {Promise<void>} The returned promise
 * @private
 */
async function _runScenario(scenario) {
    const scenarioPath = path.resolve(basePath, 'scenarios', scenario);

    const shapesPath =  path.resolve(scenarioPath, 'shapes.ttl');
    const statesPath = path.resolve(scenarioPath, 'states.ttl');
    const stepsPath = path.resolve(scenarioPath, 'steps.ttl');

    // Read goal states
    const goalStates = await _readGoalStates(scenarioPath);

    // Read the data paths (each file representing the next state of the data)
    const dataStateFiles = await _listDataStates(scenarioPath);

    // Check if optional knowledge path 'knowledge.n3' exists
    let knowledgePath = path.resolve(scenarioPath, 'knowledge.n3');
    if (existsSync(knowledgePath)) {
        console.log(`Extra reasoning logic found at ${knowledgePath}`);
    } else {
        knowledgePath = '';
    }

    // Loop over the data states and reason for every state.
    // The output will be written to a different directory for every data state.
    for (const dataStateFile of dataStateFiles) {
        console.log(`Reasoning for data file ${dataStateFile}`);
        // The label is the scenario name + the name of the data file without extension.
        const label = scenario + '_' + path.basename(dataStateFile, '.ttl');
        await reasonFlow(label, dataStateFile, stepsPath, statesPath, shapesPath, goalStates, knowledgePath);
        console.log('==================================');
    }

    console.log("Done!")
}

/**
 * Read the IRIs of goal states.
 * The goal states are supposed to be listed one per line in a file `goalStates.txt`.
 * @param scenarioPath The path to the current scenario.
 * @returns {Promise<string[]>} A promise holding an array of goal state IRIs.
 * @private
 */
async function _readGoalStates(scenarioPath) {
    // read goal states
    const goalStatesPath = path.resolve(scenarioPath, 'goalStates.txt');
    const goalStatesStr = await readFile(goalStatesPath, 'utf-8');
    const goalStatesLines = goalStatesStr.split('\n');
    // Exclude empty strings
    return goalStatesLines.filter(str => str.trim() !== "");
}

/**
 * List the data states in the scenario directory.
 * The data files must start with `data_` and are returned in alphabetical order.
 * @param scenarioPath The path to the current scenario.
 * @returns {Promise<string[]>} A promise holding an array of absolute paths to data files.
 * @private
 */
async function _listDataStates(scenarioPath) {
    const allFiles = await readdir(scenarioPath);
    return allFiles
        .filter(fileName => fileName.startsWith('data_'))
        .map(fileName => path.resolve(scenarioPath, fileName))
        .sort();
}
