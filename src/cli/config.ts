import Configstore from 'configstore';
import { FacebookConfiguration } from '../lib/struct/facebookConfiguration';

const p = require('../package.json');

export const { version } = p;

const config = new Configstore(
  p.name,
  {},
);

/**
* Function handles the user configuration in CLI
* @namespace userConfig
* @param {askQuestionsFunction} askQuestionsFunction
* @param {validatorCallback} validator
* @return {void} reutrns nothing but handles the user configuration acton
* */
export async function userConfig(
  askQuestions: (validator: (input: string) => boolean) => Promise<FacebookConfiguration>,
  validator: (input: string) => boolean,
) {
  const answers = await askQuestions(validator);
  config.set({
    username: answers.username,
    password: answers.password,
  });
}

/**
* function checks if user configured or not.
* @namespace isUserConfigured
* @return {bool} returns if user configured or not.
* */
export function isUserConfigured(): boolean {
  return (
    config.get('username') !== undefined
      && config.get('username') !== null
      && config.get('password') !== undefined
      && config.get('password') !== null
  );
}
