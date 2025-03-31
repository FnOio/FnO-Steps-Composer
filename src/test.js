import {writeFile, mkdir} from "fs/promises";
import {
    reasonStep,
    reasonJourneyLevelSteps,
    reasonContainerLevelSteps,
    reasonComponentLevelSteps,
    reasonShortStepDescriptions,
    reasonSelectedSteps,
    reasonJourney,
    reasonJourneyGoal
} from "./services/step-reasoning.js";
import {parsePaths, validateTtl, basePath} from "./services/util.js";
import path from 'path';

main();

async function main() {
    const label = 'bocemon_example';
    const index = {
        "@context": {
            "@vocab": "http://www.example.org#"
        },
        "features": {}
    };
    const config = {
        label,
        oslo: {
            shapes: path.resolve(basePath, `scenarios/${label}/shapes.ttl`),
            states: path.resolve(basePath, `scenarios/${label}/states.ttl`),
            steps: path.resolve(basePath, `scenarios/${label}/steps.ttl`),
        },
        //goalStates: ["http://localhost:8000/states#newEidPincodeRequested"],
        goalStates: ["http://localhost:8000/states#roomEquipedForHVACControl"],
    };
    await validateTtl(config.oslo.shapes);
    await validateTtl(config.oslo.states);
    await validateTtl(config.oslo.steps);
    console.log('all oslo files are valid TTL.');
    // const config = {
    //     label: "moving",
    //     oslo: {
    //         steps: "scenarios/_endevent_demo/change-address-steps.ttl",
    //         states: "scenarios/_endevent_demo/change-address-states.ttl",
    //         shapes: "scenarios/_endevent_demo/change-address-shapes.ttl",
    //     },
    //     goal: "?x <https://example.org/ns/example#wasteCollectionRequested> true ; <https://example.org/ns/example#addressChanged> true .",
    // };

    try {
        await mkdir(path.resolve(basePath, '_output/'));
    } catch (e) {
        // OK already exists
    }
    try {
        await mkdir(path.resolve(basePath, '_output/', config.label));
    } catch (e) {
        // OK already exists
    }
    const baseFolder = `_output/${config.label}`;
    const personalInfoPath = baseFolder + '/profile.ttl';
    config.baseFolder = baseFolder;
    config.personalInfo = personalInfoPath;
    await writeFile(path.resolve(basePath, personalInfoPath), '<https://example.org/ns/example#user> a <https://data.vlaanderen.be/ns/persoon#Inwoner> .', 'utf8');

    // 0️⃣
    const journeyStepsPath = await reasonJourneyLevelSteps([config.oslo.steps, config.oslo.states, config.oslo.shapes], baseFolder);

    // 1️⃣
    // here we don't need block and extraRule
    const goalPath = await reasonJourneyGoal([config.oslo.steps, config.oslo.states, config.oslo.shapes], config.goalStates, config.baseFolder);
    const journeyDescriptionsPath = await reasonShortStepDescriptions([journeyStepsPath], baseFolder, `journey`);

    // 2️⃣
    // same as for other, but without block
    const journeySelectedStepsPath = await reasonSelectedSteps([journeyStepsPath, journeyDescriptionsPath, goalPath], config.baseFolder, `journey`, 'journey')
    index.features['journey_moving'] = {
        description: "journey moving",  // TODO make parameter/variable
        inference: {
            data: [
                journeySelectedStepsPath,
                config.oslo.steps,
                config.personalInfo,
                "rules/workflow-composer/gps-plugin_modified_noPermutations.n3",
                "scenarios/knowledge.n3",
            ],
            query: goalPath
        }
    }

    // 3️⃣
    // not same as reasonPaths: this one doesn't include util/graph.n3
    const journeyPathsPath = await reasonJourney([journeySelectedStepsPath, config.oslo.steps, config.personalInfo], goalPath, config.baseFolder);

    // 0️⃣
    const containerStepsPath = await reasonContainerLevelSteps([config.oslo.steps, config.oslo.states, config.oslo.shapes], config.baseFolder);
    const containerDescriptionsPath = await reasonShortStepDescriptions([containerStepsPath], baseFolder, `container`);

    // 0️⃣
    const componentStepsPath = await reasonComponentLevelSteps([config.oslo.steps, config.oslo.states, config.oslo.shapes], config.baseFolder);
    const componentDescriptionsPath = await reasonShortStepDescriptions([componentStepsPath], baseFolder, `component`);

    const allJourneyLevelSteps = await parsePaths(journeyPathsPath);
    console.log(allJourneyLevelSteps.join(', '));
    for (const journeyLevelStep of allJourneyLevelSteps) {
        // 3️⃣
        const containerPathsPath = await reasonStep(journeyLevelStep, containerStepsPath, containerDescriptionsPath, journeyStepsPath, config, 'containers', index);
        const allContainerLevelSteps = await parsePaths(containerPathsPath);
        console.log(`for journeyLevelStep ${journeyLevelStep}, we find following containerLevelSteps: ${allContainerLevelSteps.join(', ')}`);
        for (const containerLevelStep of allContainerLevelSteps) {

            // 3️⃣
            const componentPathsPath = await reasonStep(containerLevelStep, componentStepsPath, componentDescriptionsPath, containerStepsPath, config, 'components', index);
            const allComponentLevelSteps = await parsePaths(componentPathsPath);
            console.log(`for containerLevelStep ${containerLevelStep}, we find following componentLevelSteps: ${allComponentLevelSteps.join(', ')}`);
        }
    }
    await writeFile(path.resolve(basePath, config.baseFolder, 'index.json'), JSON.stringify(index, null, '  '));

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
}


