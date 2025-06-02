import {reason} from "./eye-reasoning.js";
import path from 'path';
import {stat, writeFile} from "fs/promises";
import {basePath} from "./util.js";

//const cache = {};
const DEV_ENV = false;

async function reasonStep(parentLevelStep, stepsOutputPath, descriptionsPath, parentStepsPath, baseFolder, stepsInputPath, dataPath, type, index = {}, knowledgePath = '') {
    const parentStepName = parentLevelStep.value.split('#')[1];
    // 0️⃣
    const parentSelectedPath = await generateSelected(parentLevelStep, baseFolder, parentStepName, type, knowledgePath)

    // 1️⃣
    const parentBlockPath = await reasonBlock([parentSelectedPath, parentStepsPath], baseFolder, parentStepName, type, knowledgePath)
    const parentGoalPath = await reasonGoal([parentSelectedPath, parentStepsPath], baseFolder, parentStepName, type, knowledgePath)
    const parentExtraRulePath = await reasonExtraRule([parentSelectedPath, parentStepsPath], baseFolder, parentStepName, type, knowledgePath)

    // 2️⃣
    const selectedStepsPath = await reasonSelectedSteps([stepsOutputPath, descriptionsPath, parentGoalPath, parentBlockPath], baseFolder, parentStepName, type, knowledgePath)

    // 3️⃣
    index.features[`${type}_${parentStepName}`] = {
        description: `${type} level paths for ${parentStepName}`,
        inference: {
            data: [
                selectedStepsPath, stepsInputPath, dataPath, parentExtraRulePath,
                "rules/workflow-composer/gps-plugin_modified_noPermutations.n3",
                "rules/util/graph.n3",
            ],
            query: parentGoalPath
        }
    }
    return await _reasonPaths([selectedStepsPath, stepsInputPath, dataPath, parentExtraRulePath], parentGoalPath, baseFolder, parentStepName, type, knowledgePath);
}

async function generateSelected(step, baseFolder, label, type) {
    const output = `${baseFolder}/select_${type}_${label}.n3`;
    /*if (cache[output]) {
        return output;
    }*/
    const goal = `
@prefix step: <http://localhost:8000/steps#>.
@prefix : <http://example.org#> .

<${step.value}> :findSubpath true.
    `;
    await writeFile(path.resolve(basePath, output), goal, 'utf8');
    //cache[output] = output;
    return output;
}

async function reasonBlock(data, baseFolder, label, type, knowledgePath) {
    const produceBase = {
        data,
        query: "rules/workflow-composer/subgoals/query_creationOfBlockingInfo.n3",
    }
    const output = `${baseFolder}/block_${type}_${label}.n3`;
    await _cached(output, produceBase, knowledgePath);
    return output;
}

async function reasonGoal(data, baseFolder, label, type, knowledgePath) {
    const produceBase = {
        data,
        query: "rules/workflow-composer/subgoals/query_subgoalCreation.n3",
    }
    const output = `${baseFolder}/goal_${type}_${label}.n3`;
    await _cached(output, produceBase, knowledgePath);
    return output;
}

async function reasonExtraRule(data, baseFolder, label, type, knowledgePath) {
    const produceBase = {
        data,
        query: "rules/workflow-composer/query_creationOfRuleForMissingData.n3",
    }
    const output = `${baseFolder}/extra_rule_${type}_${label}.n3`;
    await _cached(output, produceBase, knowledgePath);
    return output;
}

async function _reasonPaths(data, query, baseFolder, label, type, knowledgePath) {
    const produceBase = {
        data: [
            "rules/workflow-composer/gps-plugin_modified_noPermutations.n3",
            "rules/util/graph.n3",
        ].concat(data),
        query,
    }
    const output = `${baseFolder}/reason_paths_${type}_${label}.n3`;
    await _cached(output, produceBase, knowledgePath);
    return output;
}

async function _cached(output, config, knowledgePath) {
    // console.log(`Working for output ${output}`)
    // if (!alwaysReason && await _fileExists(path.resolve(basePath, output))) {
    //     if (!DEV_ENV) {
    //         cache[output] = output;
    //     }
    // }
    // if (cache[output]) {
    //     return;
    // }
    config.output = output;
    if (knowledgePath !== '') {
        config.data.push(knowledgePath);
    }
    config.basePath = basePath;
    const result = await reason(config);
    return await writeFile(path.resolve(config.basePath, config.output), result, 'utf8');
    //cache[output] = true;
}

async function reasonJourneyLevelSteps(data, baseFolder, knowledgePath) {
    return _reasonLevelSteps(data, baseFolder, 'query_journeyStepToGPSDescription.n3', 'steps_journey_level.n3', knowledgePath);
}

async function reasonContainerLevelSteps(data, baseFolder, knowledgePath) {
    return _reasonLevelSteps(data, baseFolder, 'query_containerStepToGPSDescription.n3', 'steps_container_level.n3', knowledgePath);
}

async function reasonComponentLevelSteps(data, baseFolder, knowledgePath) {
    return _reasonLevelSteps(data, baseFolder, 'query_componentStepToGPSDescription.n3', 'steps_component_level.n3', knowledgePath);
}

async function _reasonLevelSteps(data, baseFolder, query, outputFile, knowledgePath) {
    const produceBase = {
        data: [
            "rules/oslo-steps/step-reasoning.n3",
            "rules/util/list.n3",
            "rules/shacl/createPattern.n3",
        ].concat(data),
        query: `rules/oslo-steps/${query}`,
    }
    const output = `${baseFolder}/${outputFile}`;
    await _cached(output, produceBase, knowledgePath);
    return output;
}

async function reasonJourneyGoal(data, goalStates, baseFolder, knowledgePath) {
    const goalStatePath = `${baseFolder}/goal_journey_state.n3`;
    await writeFile(path.resolve(basePath, goalStatePath), goalStates.map(s => `<${s}> a <https://example.org/ns/example#goalState> .`).join('\n'), 'utf8');
    const produceBase = {
        data: [
            "rules/oslo-steps/step-reasoning.n3",
            "rules/util/list.n3",
            "rules/shacl/createPattern.n3",
            goalStatePath,
        ].concat(data),
        query: "rules/oslo-steps/query_journeyGoalToGPSPath.n3",
    }
    const output = `${baseFolder}/goal_journey.n3`;
    await _cached(output, produceBase, knowledgePath);
    return output;
}

async function reasonShortStepDescriptions(data, baseFolder, label, knowledgePath) {
    const produceBase = {
        data: data,
        query: "rules/workflow-composer/preselection/pregeneration.n3",
    }
    const output = `${baseFolder}/short_step_descriptions_${label}.n3`;
    await _cached(output, produceBase, knowledgePath);
    return output;
}

async function reasonSelectedSteps(data, baseFolder, label, type, knowledgePath) {
    const produceBase = {
        data: [
            "rules/workflow-composer/preselection/preselection.n3"
        ].concat(data),
        query: "rules/workflow-composer/preselection/query_preselection.n3",
    }
    const output = `${baseFolder}/selected_steps_${type}_${label}.n3`;
    await _cached(output, produceBase, knowledgePath);
    return output;
}

async function reasonJourney(data, query, baseFolder, knowledgePath) {
    const produceBase = {
        data: [
            "rules/workflow-composer/gps-plugin_modified_noPermutations.n3"
        ].concat(data),
        query,
    }
    const output = `${baseFolder}/reason_journey.n3`;
    await _cached(output, produceBase, knowledgePath);
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

/**
 * 3️⃣ Journey moving
 * - gps-plugin_modified_noPermutations -> ENGINE
 * - knowledge -> ENGINE
 * - selectedSteps_Journey -> INTERIM
 * - oslo-steps/steps -> CONFIG
 * - personalInfo -> RUNTIME
 * - Q journeyGoal -> GENERATED FOR JOURNEY FROM CONFIG
 */

/**
 * 2️⃣ selectedSteps_Journey
 * - journey-level-steps -> INTERIM
 * - shortJourneyDescriptions -> INTERIM
 * - journeyGoal -> GENERATED FOR JOURNEY FROM CONFIG
 * - preselection -> ENGINE
 * - knowledge -> ENGINE
 * - query_preselection -> ENGINE
 */

/**
 * 1️⃣ shortJourneyDescriptions
 * - journey-level-steps -> INTERIM
 * - knowledge -> ENGINE
 * - Q pregeneration -> ENGINE
 */

/**
 * 0️⃣ journey-level-steps
 * - oslo-steps/steps -> CONFIG
 * - oslo-steps/states -> CONFIG
 * - oslo-steps/shapes -> CONFIG
 * - step-reasoning -> ENGINE
 * - help -> ENGINE
 * - createPattern -> ENGINE
 * - query_journeyStepToGPSDescription -> ENGINE
 */

/**
 * ---------- PER JOURNEY
 */

/**
 * 3️⃣ container_providePersonalInformation
 * - gps-plugin_modified_noPermutations -> ENGINE
 * - knowledge -> ENGINE
 * - selectedSteps_personalInfo -> INTERIM
 * - oslo-steps/steps -> CONFIG
 * - personalInfo -> RUNTIME
 * - extraRule_personalInfo -> INTERIM
 * - util/graph -> ENGINE
 * - Q createdGoal_PersonalInfo -> INTERIM
 */

/**
 * 1️⃣ extraRule_personalInfo
 * - selected_PersonalInfo -> GENERATED FOR CONTAINER
 * - journey-level-steps -> INTERIM
 * - query_creationOfRuleForMissingData -> ENGINE
 */

/**
 * 2️⃣ selectedSteps_personalInfo
 * - container-level-steps -> INTERIM
 * - shortContainerDescriptions -> INTERIM
 * - createdGoal_PersonalInfo -> INTERIM
 * - preselection -> ENGINE
 * - knowledge -> ENGINE
 * - block_personalInfo -> INTERIM
 * - query_preselection -> ENGINE
 */

/**
 * 1️⃣ createdGoal_PersonalInfo
 * - selected_PersonalInfo -> GENERATED FOR CONTAINER
 * - journey-level-steps -> INTERIM
 * - query_subgoalCreation -> ENGINE
 */

/**
 * 0️⃣ container-level-steps
 * - oslo-steps/steps -> CONFIG
 * - oslo-steps/states -> CONFIG
 * - oslo-steps/shapes -> CONFIG
 * - step-reasoning -> ENGINE
 * - help -> ENGINE
 * - createPattern -> ENGINE
 * - query_containerStepToGPSDescription -> ENGINE
 */

/**
 * 1️⃣ shortContainerDescriptions
 * - container-level-steps -> INTERIM
 * - knowledge -> ENGINE
 * - Q pregeneration -> ENGINE
 */

/**
 * 1️⃣ block_personalInfo
 * - selected_PersonalInfo -> GENERATED FOR CONTAINER
 * - journey-level-steps -> INTERIM
 * - query_creationOfBlockingInfo -> ENGINE
 */

/**
 * -------- PER CONTAINER
 */

/**
 * 3️⃣ component_provideCitizenNameManually
 * - gps-plugin_modified_noPermutations -> ENGINE
 * - knowledge -> ENGINE
 * - personalInfo -> RUNTIME
 * - extraRule_citizenName -> INTERIM
 * - util/graph -> ENGINE
 * - selectedSteps_citizenName -> INTERIM
 * - oslo-steps/steps -> CONFIG
 * - Q createdGoal_citizenName -> INTERIM
 */

/**
 * 1️⃣ extraRule_citizenName
 * - selected_CitizenName -> GENERATED FOR CONTAINER
 * - container-level-steps -> INTERIM
 * - query_creationOfRuleForMissingData -> ENGINE
 */

/**
 * 2️⃣ selectedSteps_citizenName
 * - component-level-steps -> INTERIM
 * - shortComponentDescriptions -> INTERIM
 * - createdGoal_citizenName -> INTERIM
 * - preselection -> ENGINE
 * - knowledge -> ENGINE
 * - block_citizenName -> INTERIM
 * - query_preselection -> ENGINE
 */

/**
 * 1️⃣ createdGoal_citizenName
 * - selected_CitizenName -> GENERATED FOR CONTAINER
 * - container-level-steps -> INTERIM
 * - query_subgoalCreation -> ENGINE
 */

/**
 * 0️⃣ component-level-steps
 * - oslo-steps/steps -> CONFIG
 * - oslo-steps/states -> CONFIG
 * - oslo-steps/shapes -> CONFIG
 * - step-reasoning -> ENGINE
 * - help -> ENGINE
 * - createPattern -> ENGINE
 * - query_componentStepToGPSDescription -> ENGINE
 */

/**
 * 1️⃣ shortComponentDescriptions
 * - component-level-steps -> INTERIM
 * - knowledge -> ENGINE
 * - Q pregeneration -> ENGINE
 */

/**
 * 1️⃣ block_citizenName
 * - selected_CitizenName -> GENERATED FOR CONTAINER
 * - container-level-steps -> INTERIM
 * - query_creationOfBlockingInfo -> ENGINE
 */
