/* eslint-disable no-useless-escape */
/* eslint-disable prefer-promise-reject-errors */
/**
 * Builds the command necessary to run the reasoner.
 *
 * Original author: Cristian Vasquez
 *
 * Source: https://github.com/cristianvasquez/HES-Agent/blob/master/readme.md
 * @module Services/Reasoning
 */
const fs = require('fs/promises');
const n3reasoner = require('eyereasoner').n3reasoner;
const path = require('path')

const basePath = path.resolve(__dirname, '..', '..');

/**
 * @typedef {Object} module:Reasoning.Inference
 * @property {String} query - Path to N3 file containing the query to be passed to the reasoner
 * @property {String[]} data - Array of paths to N3 files containing the auxiliary data to be used by the reasoner
 */
async function reason(inference) { // TODO: handle proof; is this possible with JS version of eye?
  // first concatenate all input into one big string.
  let dataString = '';
  for (const input of inference.data) {
    const contents = await fs.readFile(path.resolve(basePath, input), 'utf8');
    dataString = dataString + contents;
  }

  let resultString = '';
  if (inference.query) {
    let queryString = await fs.readFile(path.resolve(basePath, inference.query), 'utf8');
    resultString = await n3reasoner(dataString, queryString);
  } else {
    resultString = await n3reasoner(dataString);
  }
  return resultString;
}

module.exports = {
  reason: reason
}
