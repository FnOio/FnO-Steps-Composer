import {reason} from "./reasoning.js";
import path from 'path';
import {stat, writeFile} from "fs/promises";
import {basePath} from "./util.js";

const cache = {};
const DEV_ENV = false;

async function reasonStep(parentLevelStep, stepsPath, descriptionsPath, parentStepsPath, config, type, index = {}) {
    const parentStepName = parentLevelStep.value.split('#')[1];
    // 0️⃣
    const parentSelectedPath = await generateSelected(parentLevelStep, config.baseFolder, parentStepName, type)

    // 1️⃣
    const parentBlockPath = await reasonBlock([parentSelectedPath, parentStepsPath], config.baseFolder, parentStepName, type)
    const parentGoalPath = await reasonGoal([parentSelectedPath, parentStepsPath], config.baseFolder, parentStepName, type)
    const parentExtraRulePath = await reasonExtraRule([parentSelectedPath, parentStepsPath], config.baseFolder, parentStepName, type)

    // 2️⃣
    const selectedStepsPath = await reasonSelectedSteps([stepsPath, descriptionsPath, parentGoalPath, parentBlockPath], config.baseFolder, parentStepName, type)

    // 3️⃣
    index.features[`${type}_${parentStepName}`] = {
        description: `${type} level paths for ${parentStepName}`,
        inference: {
            data: [
                selectedStepsPath, config.oslo.steps, config.personalInfo, parentExtraRulePath,
                "rules/workflow-composer/gps-plugin_modified_noPermutations.n3",
                "scenarios/knowledge.n3",
                "rules/util/graph.n3",
            ],
            query: parentGoalPath
        }
    }
    return await _reasonPaths([selectedStepsPath, config.oslo.steps, config.personalInfo, parentExtraRulePath], parentGoalPath, config.baseFolder, parentStepName, type);
}

async function generateSelected(step, baseFolder, label, type) {
    const output = `${baseFolder}/select_${type}_${label}.n3`;
    if (cache[output]) {
        return output;
    }
    const goal = `
@prefix step: <http://localhost:8000/steps#>.
@prefix : <http://example.org#> .

<${step.value}> :findSubpath true.
    `;
    await writeFile(path.resolve(basePath, output), goal, 'utf8');
    cache[output] = output;
    return output;
}

async function reasonBlock(data, baseFolder, label, type) {
    const produceBase = {
        data,
        query: "rules/workflow-composer/subgoals/query_creationOfBlockingInfo.n3",
    }
    const output = `${baseFolder}/block_${type}_${label}.n3`;
    await _cached(output, produceBase);
    return output;
}

async function reasonGoal(data, baseFolder, label, type) {
    const produceBase = {
        data,
        "eye:flags": [
            "--quantify http://josd.github.io/.well-known/genid/",
        ],
        query: "rules/workflow-composer/subgoals/query_subgoalCreation.n3",
    }
    const output = `${baseFolder}/goal_${type}_${label}.n3`;
    await _cached(output, produceBase);
    return output;
}

async function reasonExtraRule(data, baseFolder, label, type) {
    const produceBase = {
        data,
        query: "rules/workflow-composer/query_creationOfRuleForMissingData.n3",
    }
    const output = `${baseFolder}/extra_rule_${type}_${label}.n3`;
    await _cached(output, produceBase);
    return output;
}

async function _reasonPaths(data, query, baseFolder, label, type) {
    const produceBase = {
        data: [
            "rules/workflow-composer/gps-plugin_modified_noPermutations.n3",
            "scenarios/knowledge.n3",
            "rules/util/graph.n3",
        ].concat(data),
        query,
    }
    const output = `${baseFolder}/reason_paths_${type}_${label}.n3`;
    await _cached(output, produceBase, true);
    return output;
}

async function _cached(output, config, alwaysReason = false) {
    // console.log(`Working for output ${output}`)
    if (!alwaysReason && await _fileExists(path.resolve(basePath, output))) {
        if (!DEV_ENV) {
            cache[output] = output;
        }
    }
    if (cache[output]) {
        return;
    }
    config.output = output;
    await _reason(config);
    cache[output] = true;
    return;
}

async function _reason(step) {
    step.basePath = basePath;
    const result = await reason(step);
    return await writeFile(path.resolve(step.basePath, step.output), result, 'utf8');
}

async function reasonJourneyLevelSteps(data, baseFolder) {
    return _reasonLevelSteps(data, baseFolder, 'query_journeyStepToGPSDescription.n3', 'steps_journey_level.n3');
}

async function reasonContainerLevelSteps(data, baseFolder) {
    return _reasonLevelSteps(data, baseFolder, 'query_containerStepToGPSDescription.n3', 'steps_container_level.n3');
}

async function reasonComponentLevelSteps(data, baseFolder) {
    return _reasonLevelSteps(data, baseFolder, 'query_componentStepToGPSDescription.n3', 'steps_component_level.n3');
}

async function _reasonLevelSteps(data, baseFolder, query, outputFile) {
    const produceBase = {
        data: [
            "rules/oslo-steps/step-reasoning.n3",
            "rules/util/list.n3",
            "rules/shacl/createPattern.n3",
        ].concat(data),
        "eye:flags": [
            "--quantify http://josd.github.io/.well-known/genid/",
        ],
        query: `rules/oslo-steps/${query}`,
    }
    const output = `${baseFolder}/${outputFile}`;
    await _cached(output, produceBase);
    return output;
}

async function reasonJourneyGoal(data, goalStates, baseFolder) {
    const goalStatePath = `${baseFolder}/goal_journey_state.n3`;
    await writeFile(path.resolve(basePath, goalStatePath), goalStates.map(s => `<${s}> a <https://example.org/ns/example#goalState> .`).join('\n'), 'utf8');
    const produceBase = {
        data: [
            "rules/oslo-steps/step-reasoning.n3",
            "rules/util/list.n3",
            "rules/shacl/createPattern.n3",
            goalStatePath,
        ].concat(data),
        "eye:flags": [
            "--quantify http://josd.github.io/.well-known/genid/",
        ],
        query: "rules/oslo-steps/query_journeyGoalToGPSPath.n3",
    }
    const output = `${baseFolder}/goal_journey.n3`;
    await _cached(output, produceBase);
    return output;
}

async function reasonShortStepDescriptions(data, baseFolder, label) {
    const produceBase = {
        data: [
            "scenarios/knowledge.n3",
        ].concat(data),
        query: "rules/workflow-composer/preselection/pregeneration.n3",
    }
    const output = `${baseFolder}/short_step_descriptions_${label}.n3`;
    await _cached(output, produceBase);
    return output;
}

async function reasonSelectedSteps(data, baseFolder, label, type) {
    const produceBase = {
        data: [
            "rules/workflow-composer/preselection/preselection.n3",
            "scenarios/knowledge.n3",
        ].concat(data),
        query: "rules/workflow-composer/preselection/query_preselection.n3",
    }
    const output = `${baseFolder}/selected_steps_${type}_${label}.n3`;
    await _cached(output, produceBase);
    return output;
}

async function reasonJourney(data, query, baseFolder) {
    const produceBase = {
        data: [
            "rules/workflow-composer/gps-plugin_modified_noPermutations.n3",
            "scenarios/knowledge.n3",
        ].concat(data),
        query,
    }
    const output = `${baseFolder}/reason_journey.n3`;
    await _cached(output, produceBase, true);
    return output;
}

const _fileExists = async path => !!(await stat(path).catch(e => false));

export {
    reasonStep,
    reasonJourneyLevelSteps,
    reasonContainerLevelSteps,
    reasonComponentLevelSteps,
    reasonShortStepDescriptions,
    reasonSelectedSteps,
    reasonJourney,
    reasonJourneyGoal
};
