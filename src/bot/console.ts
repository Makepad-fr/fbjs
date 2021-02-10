import inquirer from "inquirer";
import minimist from "minimist";
import { version } from "../config";
import { FacebookConfiguration } from "../struct/facebookConfiguration";


/**
  * Function gets the user configuration information by asking
  *  related questions to user.
  * @namespace askConfigQuestions
  * @param {(input: string) => boolean} validator function to validate the user input
  * @return {Object} returns answer object got from the user
**/
export async function askConfigQuestions(validator: (input: string) => boolean): Promise<FacebookConfiguration> {
    const answers: FacebookConfiguration = await inquirer.prompt([
      {
        name: 'username',
        type: 'input',
        message: 'facebook username:',
        validate: validator,
      },
      {
        name: 'password',
        type: 'password',
        message: 'password:',
        validate: validator,
      },
    ]);
    return answers;
  }
  
/**
  * function shows the version of CLI.
  * @namespace getVersion
  * @return {void} returns nothing but shows CLI version on console
**/
export function getVersion() {
  console.log(version);
}


