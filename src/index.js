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
* Function handles the user configuration in CLI
* @namespace userConfig
* @return {void} reutrns nothing but handles the user configuration acton
**/
async function userConfig() {
  const validateFunction = function(input) {
    return input.length !== 0;
  };
  const answers = await inquirer.prompt([
    {
      name: 'facebook-username',
      type: 'input',
      message: 'facebook username:',
      validate: validateFunction,
    },
    {
      name: 'facebook-password',
      type: 'password',
      message: 'password:',
      validate: validateFunction,
    },
  ]);
  config.set({
    username: answers['facebook-username'],
    password: answers['facebook-password'],
  });
}
/**
* Function shows help page.
* @namespace help
* @return {void} returns nothing but shows help page on the console.
**/
function help() {
  // TODO: Choose color
  const magenta = chalk.magenta;

  /**
  * Function show a help page line on the console.
  * @namespace helpPageLine
  * @param {String} command command name to show
  * @param {String} description command description to show
  * @return {void} returns nothing but shows the help page line on the console
  **/
  function helpPageLine(command, description) {
    console.info('  ' + magenta(command) + ':  ' + description);
  }

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
* @param {String} message message to display.
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
* function scrolls the page.
* @namespace autoScroll
* @param {Page} page the current page opened on browser
* @return {void} returns nothing but scrolls the page.
**/
async function autoScroll(page) {
  await page.evaluate(async () => {
    /**
    * function description.
    * @namespace sleep
    * @param {int} time parameter description
    * @return {returnType} returns nothing but
    *
    **/
    function sleep(time) {
      return new Promise(function(resolve) {
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
* @param {String} groupId facebook group id
* @return {String} returns the Facebook group url
* related to the given Facebook group id
**/
function generateFacebookGroupUrlFromId(groupId) {
  return 'https://m.facebook.com/groups/' + groupId + '/';
}

/**
* Function handles the Frabook login of the user.
* @namespace facebookLogin
* @param {Object} arguments command line arguments parsed with minimisr
* @return {Page} returns the page when the user logged in
**/
async function facebookLogIn(arguments) {
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

  /**
   * We need an incognito browser to avoid notification
   *  and location permissions of Facebook
  **/
  const incognitoContext = await browser.createIncognitoBrowserContext();
  // Creates a new borwser tab
  const page = await incognitoContext.newPage();
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
  return page;
}

/**
* Function handles the main execution of the Facebook bot.
* @namespace facebookMain
* @param {Object} arguments Command line arguments parsed with minimist
* @param {String} groupUrl The url of the Facebook group
* @param {Page} page The actual page of browser
* @param {String} id The id of the facebook group
* @return {void} returns nothing but scrape all questions from specific groups
**/
async function facebookMain(arguments, groupUrl, page, id) {
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


    await autoScroll(page);
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
* @return {void} returns nothing but calls the FacebookMain
* function for each groupId once logged in
**/
async function main(arguments) {
  if (isUserConfigured() === false) {
    await userConfig();
  }

  const facebookGroupIdList = arguments['group-ids'].split(',');
  const page = await facebookLogIn(arguments);
  // for (var i = 0; i < facebookGroupIdList.length; i++) {
  for (let i = 0; i < facebookGroupIdList.length; i++) {
    const id = facebookGroupIdList[i];
    const groupUrl = generateFacebookGroupUrlFromId(id);
    await facebookMain(arguments, groupUrl, page, id);
  }
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
  help();
  process.exit(0);
}

if (arguments['version'] === true) {
  version();
  process.exit(0);
}

// if (arguments['_'].includes('init')) {
if (arguments['_'].indexOf('init') !== -1) {
  userConfig().then(() => {
    process.exit(0);
  });
}

if (arguments['group-ids'] !== undefined && arguments['group-ids'] !== null) {
  main(arguments).then(() => {
    console.log('Facebook group scraping done');
  });
} else {
  error('No argument specified. Please check help page for valid arguments');
  help();
  process.exit(1);
}


