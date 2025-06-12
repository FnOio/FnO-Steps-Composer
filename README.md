# FnO-Steps composer

Composing a workflow using [FnO-Steps](https://github.com/FnOio/FnO-Steps).

Based on the OSLO-steps workflow composer as presented in:

Dörthe Arndt, Sven Lieber, Raf Buyle, Sander Goossens, David De Block,
Ben De Meester, and Erik Mannens. 2021.
Dynamic Workflow Composition with OSLO-steps: Data Re-use and Simplification
of Automated Administration.
In Proceedings of the 11th Knowledge Capture Conference (K-CAP ’21),
December 2–3, 2021, Virtual Event, USA. ACM, New York, NY, USA,
4 pages.
<https://doi.org/10.1145/3460210.3493559>

## Set-up

Install all required modules:
```shell
cd src/
npm install
```

## Scenarios

The workflow composer typically runs a *scenario*.
A scenario consists of a set of *states*, *shapes* and *states*, a set of *data* files and a set of *goal states*.
Make sure all files are UTF-8 encoded.

Here is an example of a scenario (`scenarios/bocemon_example`):
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

## Running a scenario
Go to the `src` directory.
```shell
cd src/
```

Show help:

```shell
node scenario.js --help
Usage: scenario [options]

Options:
  -s --scenario <name>               The scenario to run. It must be a subdirectory of `scenarios`
  -d --dataFile <name of data file>  Use this option if you want to run only one data file.
  -h, --help                         display help for command
```

where `name` is the name of a subdirectory in `scenarios/`, e.g. `bocemon_example`
and `name of data file` is a certain data file.

### examples

Run the `bocemon_example` scenario:
```shell
node scenario.js -s bocemon_example
```

Run the example with the (data) state as described in `data_03.ttl`:
```shell
node scenario.js -s bocemon_example -d data_03.ttl
```

## Organization

- `rules`: all N3 rules
  - `oslo-steps`: all FnO-Steps rules
  - `shacl`: transformation rules for SHACL as shape language
  - `util`: utility functions
  - `workflow-composer`: workflow composer (optimization) rules
- `scenarios`: demonstrator sets of steps, states, and shapes
- `src`: JavaScript Node.js code to use the N3 rules

All output files are stored under `_output`, per scenario.

## Background

### Workflow Composer Optimizations

- Preselection to make sure that only the linked to steps are taken into account, not _all_ described steps.
- noPermutations: disable permutations to make sure no redundant suggestions are made (e.g. when there are no dependencies between them, paths `provideFirstName > provideLastName` is equivalent to `provideLastName > provideFirstName` are deemed equivalent)
