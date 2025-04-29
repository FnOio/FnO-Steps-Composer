/**
 * This file contains code reasoning over a flow (of steps).
 */
import {mkdir, rm, writeFile, copyFile, readFile} from "fs/promises";
import path from "path";
import {basePath, parsePaths, validateTtl} from "./util.js";
import {
    reasonComponentLevelSteps,
    reasonContainerLevelSteps,
    reasonJourney,
    reasonJourneyGoal,
    reasonJourneyLevelSteps,
    reasonSelectedSteps,
    reasonShortStepDescriptions, reasonStep
} from "./step-reasoning.js";

/**
 *
 * @param {String} label Name of the flow. This will be used to make a subdirectory in the _output directory.
 * @param {String} dataPath The path to a file with data to reason upon (in Turtle).
 * @param {String} stepsPath The path to the steps descriptions (in Turtle).
 * @param {String} statesPath The path to the states descriptions (in Turtle).
 * @param {String} shapesPath The path to the shapes descriptions (in Turtle).
 * @param {String[]} goalStates Array of IRIs of states that represent a goal (end state).
 * @param {String} knowledgePath Optional. If given, this is the path to an n3 file with extra rules ("knowledge") the reasoner can take into account.
 * @returns {Promise<void>}
 */
async function reasonFlow(label, dataPath, stepsPath, statesPath, shapesPath, goalStates, knowledgePath = '') {

    // validate input data
    await validateTtl(stepsPath);
    await validateTtl(shapesPath);
    await validateTtl(statesPath);
    await validateTtl(dataPath);
    console.log('all input files are valid TTL.');

    // TODO: check if goal states are in statesPath

    const baseFolder = path.resolve(basePath, '_output/', label);
    await rm(baseFolder, {recursive: true, force: true});
    await mkdir(baseFolder, {recursive: true});

    // copy file dataPath to baseFolder
    const dataCopyPath = path.resolve(baseFolder, 'data.ttl');
    await copyFile(dataPath, dataCopyPath);

    // print data
    const dataStr = await readFile(dataCopyPath, 'utf8');
    console.log('data: \n' + dataStr);

    // initialize index: an object keeping paths to the generated output
    const index = {
        "@context": {
            "@vocab": "http://www.example.org#"
        },
        "features": {}
    };

    const journeyStepsPath = await reasonJourneyLevelSteps([stepsPath, statesPath, shapesPath], baseFolder);

    // 1️⃣
    // here we don't need block and extraRule
    const goalPath = await reasonJourneyGoal([stepsPath, statesPath, shapesPath], goalStates, baseFolder);
    const journeyDescriptionsPath = await reasonShortStepDescriptions([journeyStepsPath], baseFolder, `journey`, knowledgePath);

    // 2️⃣
    // same as for other, but without block
    const journeySelectedStepsPath = await reasonSelectedSteps([journeyStepsPath, journeyDescriptionsPath, goalPath], baseFolder, `journey`, 'journey', knowledgePath)
    index.features[label] = {
        description: label,
        inference: {
            data: [
                journeySelectedStepsPath,
                stepsPath,
                dataCopyPath,
                "rules/workflow-composer/gps-plugin_modified_noPermutations.n3"
            ],
            query: goalPath
        }
    }
    if (knowledgePath !== '') {
        index.features[label].inference.data.push(knowledgePath);
    }

    // 3️⃣
    // not same as reasonPaths: this one doesn't include util/graph.n3
    const journeyPathsPath = await reasonJourney([journeySelectedStepsPath, stepsPath, dataCopyPath], goalPath, baseFolder, knowledgePath);

    const allJourneyLevelSteps = await parsePaths(journeyPathsPath);
    //console.log(allJourneyLevelSteps.join(', '));

    console.log('Steps to take:');
    for (const journeyLevelStep of allJourneyLevelSteps) {
        // 0️⃣
        const containerStepsPath = await reasonContainerLevelSteps([stepsPath, statesPath, shapesPath], baseFolder);
        const containerDescriptionsPath = await reasonShortStepDescriptions([containerStepsPath], baseFolder, `container`, knowledgePath);
        // 3️⃣
        const containerPathsPath =
            await reasonStep(journeyLevelStep, containerStepsPath, containerDescriptionsPath, journeyStepsPath, baseFolder, stepsPath, dataCopyPath, 'containers', index, knowledgePath);
        const allContainerLevelSteps = await parsePaths(containerPathsPath);
        console.log(`${journeyLevelStep}`);
        //console.log(`for journeyLevelStep ${journeyLevelStep}, we find following containerLevelSteps: ${allContainerLevelSteps.join(', ')}`);
        for (const containerLevelStep of allContainerLevelSteps) {
            console.log('  ' + containerLevelStep);
            // 0️⃣
            const componentStepsPath = await reasonComponentLevelSteps([stepsPath, statesPath, shapesPath], baseFolder);
            const componentDescriptionsPath = await reasonShortStepDescriptions([componentStepsPath], baseFolder, `component`, knowledgePath);
            // 3️⃣
            const componentPathsPath =
                await reasonStep(containerLevelStep, componentStepsPath, componentDescriptionsPath, containerStepsPath, baseFolder, stepsPath, dataCopyPath, 'components', index, knowledgePath);
            const allComponentLevelSteps = await parsePaths(componentPathsPath);
            //console.log(`for containerLevelStep ${containerLevelStep}, we find following componentLevelSteps: ${allComponentLevelSteps.join(', ')}`);
            console.log(`    ${allComponentLevelSteps.join('\n    ')}`);
        }
    }
    await writeFile(path.resolve(baseFolder, 'index.json'), JSON.stringify(index, null, '  '));
}

export {reasonFlow};
