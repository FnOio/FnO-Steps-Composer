# README

N3 mapping rules for the workflow composer that dynamically reasons about the next journey, container, or component-level steps to be executed.

## Set-up

To run the rules, we provided a test script using [Node.js](https://nodejs.org) that ties all phases together.
To run it, do

```shell
cd src/
npm install
npm run test
```

## Run a scenario
```shell
cd src/
npm run scenario -- --scenario <name>
```
where `name` is the name of a subdirectory in `scenarios/`, e.g. `bocemon_example`.

Running a scenario requires a certain file layout. For example:
```
bocemon_example/
├── data_01.ttl
├── data_02.ttl
├── data_03.ttl
├── data_04.ttl
├── data_05.ttl
├── flow.md
├── goalStates.txt
├── shapes.ttl
├── states.ttl
└── steps.ttl
```
- `data_x.ttl`: The input data (knowledge) at stage `x`. Every file represents an iteration of the flow. This data is used to reason upon.
- `goalStates.txt`: A list of state IRIs that are a goal, i.e. end state of the flow. List one goal per line. These IRIs need to be found in `states.ttl`.
- `shapes.ttl`: The shapes that define a state. If the data complies to a shape, the flow is in the state that requires the shape.
- `states.ttl`: The possible states in this flow. A state lists required shapes.
- `steps.ttl`: The possible steps in this flow. A step lists required states, and which state(s) it produces.
- `flow.md` (not required): This is a graphical illustration of the flow with states and steps.

## Organization

- `rules`: all N3 rules
  - `oslo-steps`: all OSLO-Steps specific rules
  - `shacl`: transformation rules for SHACL as shape language
  - `util`: utility funcitons
  - `workflow-composer`: workflow composer (optimization) rules
- `scenarios`: demonstrator sets of steps, states, and shapes
- `src`: JavaScript Node.js code to use the N3 rules

All output files are stored under `_output`, per scenario.
This means some intermediate files are used as cache and subsequent runs will be much faster.

## Development environment

`./convert-encoding.ps1` on `./demo/` (you will get a prompt) makes sure that all input ttl/n3 files have the right encoding

## Background

### Workflow Composer Optimizations

- Preselection to make sure that only the linked to steps are taken into account, not _all_ described steps.
- noPermutations: disable permutations to make sure no redundant suggestions are made (e.g. when there are no dependencies between them, paths `provideFirstName > provideLastName` is equivalent to `provideLastName > provideFirstName` are deemed equivalent)

### Unclarities

- What is :pattern?
  - input: stateShape
  - output: list of 4 elements
    - 1. triples graph with the path
    - 2. graph where the path graph is skolemed to the output
    - 3. output: deprecated?
    - 4. ???
- What does the :separate function do?
- What does the :unfold function do?
- What does e:skolem do?
- :ShortDescription and :reliesOn?
