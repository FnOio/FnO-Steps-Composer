const path = require('path');
const eyePromise = require('../services/reasoning.js').reason;

const basePath = path.resolve(__dirname, '../..');

main();

/**
 * Just a small testing function to test out some EYE commands
 */
async function main() {
    const config = {
        data: [
            "rules/oslo-steps/step-reasoning.n3",
            "rules/util/list.n3",
            "rules/shacl/createPattern.n3",
            "scenarios/example1/steps.ttl",
            "scenarios/example1/shapes.ttl",
            "scenarios/example1/states.ttl",
            "_output/example1/goal_journey_state.n3",
        ],
        "eye:flags": [
            "--quantify http://josd.github.io/.well-known/genid/",
            // "--pass",
        ],
        query: "rules/oslo-steps/query_journeyGoalToGPSPath.n3",
    }
    config.basePath = basePath;
    const result = await eyePromise(config);
    console.log(result);
}
