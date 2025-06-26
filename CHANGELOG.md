# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed
- Used the Javascript version of eye (eyereasoner). No need for a Docker set-up or local eye installation anymore.
- Extra rules (`knowledge.n3` in a scenario) are always passed to the reasoner.

### Added
- Simple DigiChecks scenario.
- Simple BOCEMON scenario.
- Script to run scenario.

### Changed
- Switched from CommonJS to ES modules
- Switched from n3 to graphy to check turtle/rdf files
- Moved from `oslo-steps` to `fno-steps`.
- Removed target class `o-persoon:Inwoner` from `fno-steps:StateShape`, so shapes can define their own target class.

## [1.0.0] - 2023-06-02

### Added

- First version

[1.0.0]: https://github.com/KNowledgeOnWebScale/oslo-steps-workflow-composer/releases/tag/v1.0.0
