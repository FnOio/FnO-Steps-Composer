import {reasonFlow} from "./services/flow-reasoning.js";
import {basePath} from "./services/util.js";
import path from 'path';

main();

async function main() {
    const label = 'bocemon_example';

    const shapesPath =  path.resolve(basePath, `scenarios/${label}/shapes.ttl`);
    const statesPath = path.resolve(basePath, `scenarios/${label}/states.ttl`);
    const stepsPath = path.resolve(basePath, `scenarios/${label}/steps.ttl`);
    const goalStates = ["http://localhost:8000/states#roomEquipedForHVACControl"]; // TODO: make this input file?
    const dataPath = path.resolve(basePath, `scenarios/${label}/room.ttl`);

    // const config = {
    //     label: "moving",
    //     oslo: {
    //         steps: "scenarios/_endevent_demo/change-address-steps.ttl",
    //         states: "scenarios/_endevent_demo/change-address-states.ttl",
    //         shapes: "scenarios/_endevent_demo/change-address-shapes.ttl",
    //     },
    //     goal: "?x <https://example.org/ns/example#wasteCollectionRequested> true ; <https://example.org/ns/example#addressChanged> true .",
    // };

    await reasonFlow(label, dataPath, stepsPath, statesPath, shapesPath, goalStates);
}


