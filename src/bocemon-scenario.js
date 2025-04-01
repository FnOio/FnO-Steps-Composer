const path = require('path');
const fs = require('fs/promises');
const reason = require('./services/eye-reasoning.js').reason;
const $rdf = require('rdflib');
const { Namespace } = $rdf;
const ttl_read = require('@graphy/content.ttl.read');
const streams = require("@util.js/node-streams");

const basePath = path.resolve(__dirname, '..');
let cache = {};
const DEV_ENV = false;

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
            shapes: `scenarios/${label}/shapes.ttl`,
            states: `scenarios/${label}/states.ttl`,
            steps: `scenarios/${label}/steps.ttl`,
        },
        goalStates: ["http://localhost:8000/states#roomEquipedForHVACControl"],
    };
    await validateTtl(config.oslo.shapes);
    await validateTtl(config.oslo.states);
    await validateTtl(config.oslo.steps);
    console.log('all oslo files are valid TTL.\n');

    try {
        await fs.mkdir(path.resolve(basePath, '_output/'));
    } catch (e) {
        // OK already exists
    }
    try {
        await fs.mkdir(path.resolve(basePath, '_output/', config.label));
    } catch (e) {
        // OK already exists
    }
    const baseFolder = `_output/${config.label}`;
    const personalInfoPath = baseFolder + '/profile.ttl';
    config.baseFolder = baseFolder;
    config.personalInfo = personalInfoPath;

    // Gradually add data to user so paths are updated.
    const prefixes =
        '@prefix o-persoon: <https://data.vlaanderen.be/ns/persoon#> .\n' +
        '@prefix ex: <http://example.org/ns/example#> .\n\n';

    const scenario = [
        {
            'userData': prefixes + 'ex:room a o-persoon:Inwoner . \n',
            'comment': '1. Initial: we want to install HVAC into a room.',
        },
        {
            'userData': prefixes + 'ex:room a o-persoon:Inwoner ; \n' +
                'ex:hasThermometer true .',
            'comment': '2. A thermometer has been installed.',
        },
        {
            'userData':prefixes + 'ex:room a o-persoon:Inwoner ; \n' +
                'ex:hasThermometer true ; \n' +
                'ex:hasHumiditySensor true .',
            'comment': '3. A humidity sensor has been installed.',
        },
        {
            'userData':prefixes + 'ex:room a o-persoon:Inwoner ; \n' +
                'ex:hasThermometer true ; \n' +
                'ex:hasHumiditySensor true ; \n' +
                'ex:hasHVAC true .',
            'comment': '4. The sensors have been connected to the HVAC.',
        },
        {
            'userData':prefixes + 'ex:room a o-persoon:Inwoner ; \n' +
                'ex:hasThermometer true ; \n' +
                'ex:hasHumiditySensor true ; \n' +
                'ex:hasHVAC true ; \n' +
                'ex:roomEquipedForHVACControl true .',
            'comment': '5. The room has been equiped for HVAC control',
        }
    ];

    for (const {userData, comment} of scenario) {
        await fs.rm(path.resolve(basePath, '_output/', config.label), {recursive: true, force: true});
        await fs.mkdir(path.resolve(basePath, '_output/', config.label));
        cache = {};

        console.log(comment + '\n');
        console.log(`Room data:\n${userData} \n`);

        // write user profile
        await fs.writeFile(path.resolve(basePath, config.personalInfo), userData, 'utf8');

        const journeyStepsPath = await reasonJourneyLevelSteps([config.oslo.steps, config.oslo.states, config.oslo.shapes], baseFolder);

        // 1️⃣
        // here we don't need block and extraRule
        const goalPath = await reasonJourneyGoal([config.oslo.steps, config.oslo.states, config.oslo.shapes], config.goalStates, config.baseFolder);
        const journeyDescriptionsPath = await reasonShortStepDescriptions([journeyStepsPath], baseFolder, `journey`);

        // 2️⃣
        // same as for other, but without block
        const journeySelectedStepsPath = await reasonSelectedSteps([journeyStepsPath, journeyDescriptionsPath, goalPath], config.baseFolder, `journey`, 'journey')
        index.features['journey_moving'] = {
            description: "journey moving",
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

        const allJourneyLevelSteps = await parsePaths(journeyPathsPath);
        //console.log(allJourneyLevelSteps.join(', '));

        console.log('Steps to take:');
        for (const journeyLevelStep of allJourneyLevelSteps) {
            // 0️⃣
            const containerStepsPath = await reasonContainerLevelSteps([config.oslo.steps, config.oslo.states, config.oslo.shapes], config.baseFolder);
            const containerDescriptionsPath = await reasonShortStepDescriptions([containerStepsPath], baseFolder, `container`);
            // 3️⃣
            const containerPathsPath = await reasonStep(journeyLevelStep, containerStepsPath, containerDescriptionsPath, journeyStepsPath, config, 'containers', index);
            const allContainerLevelSteps = await parsePaths(containerPathsPath);
            console.log(`${journeyLevelStep}`);
            //console.log(`for journeyLevelStep ${journeyLevelStep}, we find following containerLevelSteps: ${allContainerLevelSteps.join(', ')}`);
            for (const containerLevelStep of allContainerLevelSteps) {
                console.log('  ' + containerLevelStep);
                // 0️⃣
                const componentStepsPath = await reasonComponentLevelSteps([config.oslo.steps, config.oslo.states, config.oslo.shapes], config.baseFolder);
                const componentDescriptionsPath = await reasonShortStepDescriptions([componentStepsPath], baseFolder, `component`);
                // 3️⃣
                const componentPathsPath = await reasonStep(containerLevelStep, componentStepsPath, componentDescriptionsPath, containerStepsPath, config, 'components', index);
                const allComponentLevelSteps = await parsePaths(componentPathsPath);
                //console.log(`for containerLevelStep ${containerLevelStep}, we find following componentLevelSteps: ${allComponentLevelSteps.join(', ')}`);
                console.log(`    ${allComponentLevelSteps.join('\n    ')}`);
            }
        }
        await fs.writeFile(path.resolve(basePath, config.baseFolder, 'index.json'), JSON.stringify(index, null, '  '));

        console.log('========================================\n');
    }


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

async function reasonJourneyLevelSteps(data, baseFolder) {
    const produceBase = {
        data: [
            "rules/oslo-steps/step-reasoning.n3",
            "rules/util/list.n3",
            "rules/shacl/createPattern.n3",
        ].concat(data),
        "eye:flags": [
            "--quantify http://josd.github.io/.well-known/genid/",
        ],
        query: "rules/oslo-steps/query_journeyStepToGPSDescription.n3",
    }
    const output = `${baseFolder}/steps_journey_level.n3`;
    await _cached(output, produceBase);
    return output;
}

async function reasonContainerLevelSteps(data, baseFolder) {
    const produceBase = {
        data: [
            "rules/oslo-steps/step-reasoning.n3",
            "rules/util/list.n3",
            "rules/shacl/createPattern.n3",
        ].concat(data),
        "eye:flags": [
            "--quantify http://josd.github.io/.well-known/genid/",
        ],
        query: "rules/oslo-steps/query_containerStepToGPSDescription.n3",
    }
    const output = `${baseFolder}/steps_container_level.n3`;
    await _cached(output, produceBase);
    return output;
}

async function reasonComponentLevelSteps(data, baseFolder) {
    const produceBase = {
        data: [
            "rules/oslo-steps/step-reasoning.n3",
            "rules/util/list.n3",
            "rules/shacl/createPattern.n3",
        ].concat(data),
        "eye:flags": [
            "--quantify http://josd.github.io/.well-known/genid/",
        ],
        query: "rules/oslo-steps/query_componentStepToGPSDescription.n3",
    }
    const output = `${baseFolder}/steps_component_level.n3`;
    await _cached(output, produceBase);
    return output;
}

async function reasonJourneyGoal(data, goalStates, baseFolder) {
    const goalStatePath = `${baseFolder}/goal_journey_state.n3`;
    await fs.writeFile(path.resolve(basePath, goalStatePath), goalStates.map(s => `<${s}> a <https://example.org/ns/example#goalState> .`).join('\n'), 'utf8');
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

async function parsePaths(pathsPath) {
    const contents = await fs.readFile(path.resolve(basePath, pathsPath), 'utf8');
    const mimeType = 'text/turtle'
    const store = $rdf.graph()
    const GPS = Namespace("http://josd.github.io/eye/reasoning/gps/gps-schema#")
    const EX = Namespace("https://example.org/ns/example#")
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
    return await reasonPaths([selectedStepsPath, config.oslo.steps, config.personalInfo, parentExtraRulePath], parentGoalPath, config.baseFolder, parentStepName, type);
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
    await fs.writeFile(path.resolve(basePath, output), goal, 'utf8');
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

async function reasonPaths(data, query, baseFolder, label, type) {
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
    if (!alwaysReason && await fileExists(path.resolve(basePath, output))) {
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
    return await fs.writeFile(path.resolve(step.basePath, step.output), result, 'utf8');
}

async function validateTtl(ttlPath) {
    const ttl = await fs.readFile(path.resolve(__dirname, '../', ttlPath), 'utf8');
    const readable = streams.fromString(ttl);
    return new Promise((resolve, reject) => {
        readable.pipe(ttl_read())
            .on('error', (e_read) => {
                reject(new Error(`${ttlPath} is an invalid Turtle document: ${e_read.message}`));
            })
            .on('eof', () => {
                resolve();
            });
    });

}

const fileExists = async path => !!(await fs.stat(path).catch(e => false));
