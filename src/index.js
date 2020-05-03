#!/usr/bin/env node

const puppeteer = require('puppeteer');
const selectors = require('./selectors/facebook');
const fs = require('fs');
const inquirer = require('inquirer');
const minimist = require('minimist');
const chalk = require('chalk');
const Configstore = require('configstore');
const package = require('../package.json');

const config = new Configstore(package.name, {});
const arguments = minimist(
    process.argv.slice(2),
    {
      string: ['group-ids', 'output'],
      boolean: ['version', 'help', 'debug', 'headful'],
      _: ['init'],
      default: {'output': './'},
      alias: {h: 'help', v: 'version'},
      stopEarly: true, /* populate _ with first non-option */
    },
);

/**
* Function handles the validation of a string.
* @namespace validator
* @param {string} input the input parameter to validate
* @return {bool} returns true if the given input is valid
**/
function validator(input) {
  return input.length !== 0;
}

/**
  * This callback type is called `validatorCallback` and
  * is displayed as a global symbol.
  * @callback validatorCallback
  * @param {string} input
  * @return {boolean} returns true if the input is valid
 */

/**
  * Function gets the user configuration information by asking
  *  related questions to user.
  * @namespace askConfigQuestions
  * @param {validatorCallback} validator function to validate the user input
  * @return {Object} returns answer object got from the user
**/
async function askConfigQuestions(validator) {
  const answers = await inquirer.prompt([
    {
      name: 'facebook-username',
      type: 'input',
      message: 'facebook username:',
      validate: validator,
    },
    {
      name: 'facebook-password',
      type: 'password',
      message: 'password:',
      validate: validator,
    },
  ]);
  return answers;
}

/**
 * This callback type is called askQuestionsFunction callback and
 * is displayed as a global symbol
 * @callback askQuestionsFunction
 * @param {validatorCallback} validator
 * @return {Object} returns answer object got from the user
 */

/**
* Function handles the user configuration in CLI
* @namespace userConfig
* @param {askQuestionsFunction} askQuestionsFunction
* @param {validatorCallback} validator
* @return {void} reutrns nothing but handles the user configuration acton
**/
async function userConfig(askQuestionsFunction, validator) {
  const answers = await askConfigQuestions(validator);
  config.set({
    username: answers['facebook-username'],
    password: answers['facebook-password'],
  });
}

/**
* Function show a help page line on the console.
* @namespace helpPageLine
* @param {string} command command name to show
* @param {string} description command description to show
* @return {void} returns nothing but shows the help page line on the console
**/
function helpPageLine(command, description) {
  const magenta = chalk.magenta;
  console.info('  ' + magenta(command) + ':  ' + description);
}

/**
 * This callback type is called 'helpPageLineCallback and
 * is displayeed as global symbol
 * @callback helpPageLineCallback
 * @param {string} command command name to show
 * @param {string} description command description to show
 * @return {void} returns nothing but shows the help line on the console
 */

/**
* Function shows help page.
* @namespace help
* @param {helpPageLineCallback} helpPageLine Function that logs a help
 page line with given parameters
* @return {void} returns nothing but shows help page on the console.
**/
function help(helpPageLine) {
  console.info('Available options:');
  helpPageLine(
      '--group-ids',
      '  Indicates which groups ids that we want to' +
      ' scrape (seperated by commas)',
  );
  helpPageLine('-h, --help', '   Shows the help page');
  helpPageLine('-v, --version', 'Shows the CLI version');
  helpPageLine('--output', '     Specify the output folder destination');
  helpPageLine('--headful', '    Disable headless mode');
  console.info('Available commands:');
  helpPageLine('init', '         Initialize user configuration');
}

/**
* Function shows error message.
* @namespace error
* @param {string} message message to display.
$ @return {void} returns nothing but shows an error message on the console
**/
function error(message) {
  console.error(
      chalk.bold.red('ERROR:') +
        ' ' +
        message,
  );
}

/**
* function shows the version of CLI.
* @namespace version
* @return {void} returns nothing but shows CLI version on console
**/
function version() {
  console.log(package.version);
}

/**
* function shows if user configured or not.
* @namespace isUserConfigured
* @return {bool} returns if user configured or not.
**/
function isUserConfigured() {
  return (
    config.get('username') !== undefined &&
    config.get('username') !== null &&
    config.get('password') !== undefined &&
    config.get('password') !== null
  );
}

/**
* Function sleeps the current process for given number of milliseconds
* @namespace sleep
* @param {int} time parameter description
* @return {void} returns nothing but sleeps for time ms
**/
async function sleep(time) {
  return new Promise(function(resolve) {
    setTimeout(resolve, time);
  });
}

/**
 * This callback type is called 'sleepFunctionCallback' and
 * displayed as a global type
 * @callback sleepFunctionCallback
 * @param {int} time The number of ms that we want to sleep for
 * @return {void} returns nothing but sleeps the current process for
 * given number of milliseconds
 */

/**
* function scrolls the page.
* @namespace autoScroll
* @param {Page} page the current page opened on browser
* @param {sleepFunctionCallback} sleep The function used for
sleeping the current process
* @return {void} returns nothing but scrolls the page.
**/
async function autoScroll(page, sleep) {
  await page.evaluate(async () => {

    /**
    * Function sleeps the current process for given number of milliseconds
    * @namespace sleep
    * @param {int} time parameter description
    * @return {void} returns nothing but sleeps for time ms
    **/
    async function sleep(time) {
      return new Promise(function (resolve) {
        setTimeout(resolve, time);
      });
    }

    for (let i = 0; i < Math.round((Math.random() * 10) + 10); i++) {
      window.scrollBy(0, document.body.scrollHeight);
      await sleep(
          Math.round(
              (Math.random() * 4000) + 1000,
          ),
      );
    }
    Promise.resolve();
  });
}

/**
* Funciton generates the Facebook group URL from the given group id.
* @namespace generateFacebookGroupUrlFromId
* @param {string} groupId facebook group id
* @return {string} returns the Facebook group url
* related to the given Facebook group id
**/
function generateFacebookGroupUrlFromId(groupId) {
  return 'https://m.facebook.com/groups/' + groupId + '/';
}

/**
* function creates a browser instance.
* @namespace createBrowser
* @param {Object} arguments Comamnd line arguments parsed from user input
* @return {Browser} returns the Browser object
**/
async function createBrowser(arguments) {
  const browserOptions = {
    headless: arguments['headful'] === false,
    args: [
      '--no-sandbox',
      '--disable-setuid-sendbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu',
    ],
  };

  if (process.arch === 'arm' || process.arch === 'arm64') {
    // If processor architecture is arm or arm64 we need to use chromium browser
    browserOptions.executablePath = 'chromium-browser';
  }

  const browser = await puppeteer.launch(browserOptions);
  return browser;
}

/**
* Function creates an incognito page from the given browser instance.
* @namespace incognitoMode
* @param {Browser} browser The browser object that we want to create
 the incognito page
* @return {Page} returns the page in the incognito mode
**/
async function incognitoMode(browser) {
  /**
   * We need an incognito browser to avoid notification
   *  and location permissions of Facebook
   **/
  const incognitoContext = await browser.createIncognitoBrowserContext();
  // Creates a new borwser tab
  const page = await incognitoContext.newPage();
  return page;
}

/**
* Funciton sets the listeners to avoid to load unnecessary content.
* @namespace setPageListeners
* @param {Page} page The current page of the browser
* @return {void} returns nothing but configures listeners on the given
 page to avoid to load
* unnecessart content
**/
async function setPageListeners(page) {
  await page.setRequestInterception(true);
  const blockResources = [
    'image', 'media', 'font', 'textrack', 'object',
    'beacon', 'csp_report', 'imageset',
  ];
  page.on('request', (request) => {
    const rt = request.resourceType();
    if (
      blockResources.indexOf(rt) > 0 ||
            request.url().match(/\.((jpe?g)|png|gif)/) != null
    ) {
      request.abort();
    } else {
      request.continue();
    }
  });
}

/**
 * The callback function called 'setPageListenersCallback and
 * displayed as a global type
 * @callback setPageListenersCallback
 * @param {Page} page The page that we set our listeners on
 * @return {void} Returns nothing but sets the listeners on the given page
 */

/**
* Function handles the Frabook login of the user.
* @namespace facebookLogin
* @param {Object} arguments command line arguments parsed with minimist
* @param {Page} page the incognito page that we are using for login
* @param {setPageListenersCallback} setPageListeners the function that
 sets the page listeners to speed up
* @return {Page} returns the page when the user logged in
**/
async function facebookLogIn(arguments, page, setPageListeners) {
  // Goes to base facebook url
  await page.goto('https://facebook.com');
  /**
   * Waiting for login form JQuery selector to avoid
   * that forms elements to be not found
  **/
  await page.waitForSelector(selectors.login_form.parent);
  // Focusing to the email input
  await page.focus(selectors.login_form.email);
  // Clicking on the email form input to be able to type on input
  await page.click(selectors.login_form.email);
  // Typing on the email input the email address
  await page.keyboard.type(config.get('username'));
  // Focusing on the password input
  await page.focus(selectors.login_form.password);
  // Clicking on the password input to be able to type on it
  await page.click(selectors.login_form.password);
  // Typing the facebook password on password input
  await page.keyboard.type(config.get('password'));
  // Clicking on the submit button
  await page.click(selectors.login_form.submit);
  await page.waitForXPath('//*[@id="stories_tray"]/div/div[1]/div');
  await setPageListeners(page);
  return page;
}

/**
* function gets old publications.
* @namespace getOldPublications
* @param {type} fileName name of the file
* @return {Object[]} returns the list of all publications.
**/
function getOldPublications(fileName) {
  let allPublicationsList;
  if (fs.existsSync(fileName) === true) {
    // If file exists
    allPublicationsList = JSON.parse(
        fs.readFileSync(fileName, {encoding: 'utf8'}),
    );
  } else {
    // If file does not exists
    allPublicationsList = [];
  }
  return allPublicationsList;
}

/**
 * The callback function called getOldPublicationsCallback and
 * displayed as a global type
 * @callback getAllPublicationsCallback
 * @param {string} fileName The file name that we want to load
 * old publications from
 * @return {Object[]} The list of old publications loaded from
 *  the given fileName
 */

/**
  * The callback function called autoScrollFunction and
  * displayed as a global type
  * @callback getAutoScrollFunction
  * @param {Page} page The page that we want to scroll
  * @param {sleepFunctionCallback} sleep The sleep function that
  * we are using for waiting before scroll
  * @return {Page} The scrolled page
  */

/**
* Function handles the main execution of the Facebook bot.
* @namespace facebookMain
* @param {Object} arguments Command line arguments parsed with minimist
* @param {string} groupUrl The url of the Facebook group
* @param {Page} page The actual page of browser
* @param {string} id The id of the facebook group
* @param {getOldPublicationsCallback} getOldPublications The function used for
loading the older publications
* @param {autoScrollFunction} autoScroll The function used for
scrolling automatically
* @param {sleepFunctionCallback} sleep The sleep function that
 we use in autoScroll
* @return {void} returns nothing but scrape all questions from specific groups
**/
async function facebookMain(
    arguments,
    groupUrl,
    page,
    id,
    getOldPublications,
    autoScroll,
    sleep,
) {
  // Navigates to the first facebook group Türk Ögrenciler - Paris
  await page.goto(
      groupUrl,
      {timeout: 600000},
  );

  /**
   * Waiting for the group stories container to continue
   * and to avoid the selector not found error
  **/
  await page.waitForXPath('//*[@id="m_group_stories_container"]');
  // Getting all Facebook group posts

  const groupNameHtmlElement = (await page.$x('/html/head/title'))[0];
  let groupName = await page.evaluate(
      (el)=> {
        return el.textContent;
      },
      groupNameHtmlElement,
  );
  if (arguments['debug'] === true) {
    console.log('Group title ' + groupName);
  }

  groupName = groupName.replace(/\//g, '_');
  const fileName = arguments['output'] + groupName + '.json';

  const allPublicationsList = getOldPublications(fileName);

  // List contains all publications
  // Variable indicates if any new posts found on the page
  do {
    if (arguments['debug'] === true) {
      console.log(`Total posts before scraping ${allPublicationsList.length}`);
    }
    // eslint-disable-next-line no-var
    var isAnyNewPosts = false;
    await page.waitForXPath(
        '//article/div[@class="story_body_container"]',
    );
    const groupPostsHtmlElements = await page.$x(
        '//article/div[@class="story_body_container"]/div/span[1]',
    );
    const groupPostsAuthorHtmlElemments = await page.$x(
        '((//article/div[@class="story_body_container"])' +
        '[child::div/span])/header//strong[1]',
    );
    if (arguments['debug'] === true) {
      console.log(
          'Group post author html elements number: ' +
           groupPostsAuthorHtmlElemments.length,
      );
      console.log(
          'Group posts html elements number: ' +
          groupPostsHtmlElements.length,
      );
    }

    // Looping on each group post html elemen to get text and author
    for (let i = 0; i < groupPostsHtmlElements.length; i++) {
      const postAuthorList = await page.evaluate(
          (el, ab) => {
            return [el.textContent, ab.textContent];
          },
          groupPostsHtmlElements[i],
          groupPostsAuthorHtmlElemments[i],
      );

      // crates a publication object which contains our publication
      const publication = {
        post: postAuthorList[0],
        author: postAuthorList[1],
      };

      // variable indicates if publication exists in allPublicationsList
      let isPublicationExists = false;

      // Check if publication exists in allPublicationsList
      for (let a = 0; a<allPublicationsList.length; a++) {
        const otherPublication = allPublicationsList[a];
        if (
          (publication.post === otherPublication.post) &&
                    (publication.author === otherPublication.author)
        ) {
          // If publication exists in allPublictationList
          isPublicationExists = true;
          break;
        } else {
          // if publication does not exists in allPublictationList
          isPublicationExists = false;
        }
      }

      /**
       * Once we got the response from the check
       * publication in allPublicationsList
      **/
      if (isPublicationExists === false) {
        allPublicationsList.push(publication);
        isAnyNewPosts = true;
      }
    }

    /**
     * All html group post elements are added on
     * global publictions list (allPublictionList)
     **/
    if (arguments['debug'] === true) {
      console.log('Total posts before scrolling' + allPublicationsList.length);
    }
    /**
     *  console.log(`Total posts before
     * scrolling ${allPublicationsList.length}`);
    **/
    // Both console.log statement above are same


    await autoScroll(page, sleep);
  } while (isAnyNewPosts === true);
  console.info(
      groupName +
      ' Facebook group\'s posts scraped: ' +
      allPublicationsList.length +
      ' posts found',
  );
  fs.writeFileSync(
      fileName,
      JSON.stringify(allPublicationsList, undefined, 4),
      {encoding: 'utf8'},
  );
// await browser.close();
}

/**
* Function handles the main process of the scraper
* @namespace main
* @param {Object} arguments arguments parsed from command line with minimist
* @param {askQuestionsFunctionCallback} askQuestionsFunction
The function used for asking questions to user configuration
* @param {validatorFunctionCallback} validator The function used for
validate user answsers
* @param {createBrowserCallback} createBrowser function that creates the browser
* @param {incognitoModeCallback} incognitoMode function creates an
incognito mode from the given browser
* @param {setPageListenersCallback} setPageListeners function sets the page
* listeners on the given page
* @param {generateFacebookGroupUrlFromIdCallback} generateFacebookGroupUrlFromId
function sets the page
* listeners on the given page
* @param {facebookMainCallback} facebookMain The main function used for
 scraping data from facebook
* @param {getOldPublicationsCallback} getOldPublications The function
 used for loading old publications
* @param {autoScrollCallback} autoScroll The function used for auto scrolling
* @param {sleepFunctionCallback} sleep The function used for
sleeping the current process
* @return {void} returns nothing but calls the FacebookMain
* function for each groupId once logged in
**/
async function main(
    arguments,
    askQuestionsFunction,
    validator,
    createBrowser,
    incognitoMode,
    setPageListeners,
    generateFacebookGroupUrlFromId,
    facebookMain,
    getOldPublications,
    autoScroll,
    sleep,
) {
  if (isUserConfigured() === false) {
    await userConfig(askQuestionsFunction, validator);
  }

  const facebookGroupIdList = arguments['group-ids'].split(',');

  const browser = await createBrowser(arguments);
  let page = await incognitoMode(browser);
  page = await facebookLogIn(arguments, page, setPageListeners);
  // for (var i = 0; i < facebookGroupIdList.length; i++) {
  for (let i = 0; i < facebookGroupIdList.length; i++) {
    const id = facebookGroupIdList[i];
    const groupUrl = generateFacebookGroupUrlFromId(id);
    await facebookMain(
        arguments,
        groupUrl,
        page,
        id,
        getOldPublications,
        autoScroll,
        sleep,
    );
  }
  await browser.close();
}

if (
  fs.existsSync(arguments['output']) === false ||
    fs.lstatSync(arguments['output']).isDirectory() === false
) {
  // output is not exists or not a directory
  error(
      arguments['output'] +
      'does not exists or is not a directory. '+
      'Please retry with an existing directory path',
  );
  process.exit(1);
}

if (arguments['help'] === true) {
  help(helpPageLine);
  process.exit(0);
}

if (arguments['version'] === true) {
  version();
  process.exit(0);
}

// if (arguments['_'].includes('init')) {
if (arguments['_'].indexOf('init') !== -1) {
  userConfig(askConfigQuestions, validator).then(() => {
    process.exit(0);
  });
} else {
  if (arguments['group-ids'] !== undefined && arguments['group-ids'] !== null) {
    main(
        arguments,
        askConfigQuestions,
        validator,
        createBrowser,
        incognitoMode,
        setPageListeners,
        generateFacebookGroupUrlFromId,
        facebookMain,
        getOldPublications,
        autoScroll,
        sleep,
    ).then(() => {
      console.log('Facebook group scraping done');
    });
  } else {
    error('No argument specified. Please check help page for valid arguments');
    help(helpPageLine);
    process.exit(1);
  }
}



