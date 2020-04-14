#!/usr/bin/env node

const puppeteer = require('puppeteer');
const selectors = require('./selectors/facebook');
const fs = require('fs');
const inquirer = require('inquirer');
const minimist = require('minimist');
const chalk = require('chalk');
const configstore = require('configstore');
const package = require('../package.json');

const config = new configstore(package.name, {});
const arguments = minimist(
    process.argv.slice(2),
    {
        string: [ 'group-ids', 'output' ],
        boolean: [ 'version', 'help', 'debug' , 'headful'],
        _: ['init'],
        default: { 'output': './'},
        alias: { h: 'help', v: 'version' },
        stopEarly: true, /* populate _ with first non-option */
    }
);

async function userConfig() {
    const validateFunction = function (input) {
                return input.length !== 0;
    }
    const answers = await inquirer.prompt([
        {
            name: 'facebook-username',
            type: 'input',
            message: 'facebook username:',
            validate: validateFunction
        },
        {
            name: 'facebook-password',
            type: 'password',
            message: 'password:',
            validate: validateFunction
        }
    ]);
    config.set({
        username: answers['facebook-username'],
        password: answers['facebook-password']
    });
}

function help() {
    // TODO: Choose color
    const magenta = chalk.magenta;
    function helpPageLine(command, description) {
        console.info('  ' + magenta(command) + ':  ' + description);
    }
    
    console.info('Availible options:');
    helpPageLine('--group-ids', '  Indicates which groups ids that we want to scrape (seperated by commas)');
    helpPageLine('-h, --help', '   Shows the help page');
    helpPageLine('-v, --version', 'Shows the CLI version');
    helpPageLine('--output', '     Specify the output folder destination');
    helpPageLine('--headful', '    Disable headless mode')
    console.info('Availible commands:');
    helpPageLine('init', '         Initialize user configuration');
}

function error(message) {
    console.error(
        chalk.bold.red('ERROR:') +
        ' ' +
        message
    );
}

function version() {
    console.log(package.version);
}

function isUserConfigured()  {
    return (
        config.get('username') !== undefined &&
        config.get('username') !== null &&
        config.get('password') !== undefined &&
        config.get('password') !== null
    );
}


async function autoScroll(page){
  await page.evaluate(async () => {
    function sleep(time) {
        return new Promise(function(resolve) {
            setTimeout(resolve, time);
        });
    }

   for (var i = 0; i < Math.round((Math.random() * 10) + 10); i++) {
        window.scrollBy(0, document.body.scrollHeight);
        await sleep(
            Math.round(
                (Math.random() * 4000) + 1000
            )
        );
    }

    Promise.resolve();

  });
}

/**
* Funciton generates the Facebook group URL from the given group id.
* @namespace generateFacebookGroupUrlFromId
* @param {String} groupId facebook group id
* @return {String} returns the Facebook group url related to the given Facebook group id
**/
function generateFacebookGroupUrlFromId(groupId) {
    return "https://m.facebook.com/groups/" + groupId + "/";
}

async function facebookLogIn(arguments) {

    const browser = await puppeteer.launch(
        {
            headless: (arguments['headful'] === false),
            args: [
              "--no-sandbox",
              "--disable-setuid-sendbox",
              "--disable-dev-shm-usage",
              "--disable-accelerated-2d-canvas",
              "--disable-gpu"
              ]
        }
    );

    // We need an incognito browser to avoid notification and location permissions of Facebook
    const incognitoContext = await browser.createIncognitoBrowserContext();
    // Creates a new borwser tab
    const page = await incognitoContext.newPage();
    // Goes to base facebook url
    await page.goto('https://facebook.com');
    // Waiting for login form JQuery selector to avoid that forms elements to be not found
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
    return page;
}

/**
* Function handles the main execution of the Facebook bot.
* @namespace facebookMain
* @param {String} groupUrl The url of the Facebook group
* @return {void} returns nothing but scrape all questions from specific facebook groups
**/
async function facebookMain(arguments, groupUrl, page,id) {
  const block_resources = ["image", "media", "font", "textrack", "object", "beacon", "csp_report", "imageset"];
  page.on('request', request => {
    const rt = request.resourceType();
    if (
        block_resources.indexOf(rt) > 0 ||
        request.url().match(/\.((jpe?g)|png|gif)/) != null
    ) {
        request.abort();
    } else {
        request.continue();
    }
  });


    // Navigates to the first facebook group Türk Ögrenciler - Paris
    await page.goto(
       groupUrl,
        {timeout:600000}
    );

    // Waiting for the group stories container to continue and to avoid the selector not found error
    await page.waitForXPath('//*[@id="m_group_stories_container"]');
    // Getting all Facebook group posts

    const groupNameHtmlElement = (await page.$x('//*[@id="MRoot"]/div/div[2]/a/div/div[2]/div[1]/div/h1/div[1]'))[0];
    var groupName = await page.evaluate(
      (el)=> { return el.textContent },
      groupNameHtmlElement
    );
    if (arguments['debug'] === true) {
        console.log('Group title ' + groupName);
    }

    const fileName = arguments['output'] + groupName + '.json';

    var allPublicationsList;


    if (fs.existsSync(fileName) === true) {

        // If file exists
        allPublicationsList = JSON.parse(
            fs.readFileSync(fileName, {encoding: 'utf8'})
        );

    } else {
        // If file does not exists
        allPublicationsList = [];
    }

    // List contains all publications
    // Variable indicates if any new posts found on the page
    do {
        if (arguments['debug'] === true){
            console.log(`Total posts before scraping ${allPublicationsList.length}`);
        }
        var isAnyNewPosts = false;
        const groupPostsHtmlElements = await page.$x('//article/div[@class="story_body_container"]/div/span[1]');
        const groupPostsAuthorHtmlElemments = await page.$x('((//article/div[@class="story_body_container"])[child::div/span])/header//strong[1]');
        if (arguments['debug'] === true) {
            console.log('Group post author html elements number: ' + groupPostsAuthorHtmlElemments.length);
            console.log('Group posts html elements number: ' + groupPostsHtmlElements.length);
        }

        // Looping on each group post html elemen to get text and author
        for (var i = 0; i < groupPostsHtmlElements.length; i++) {
            var postAuthorList = await page.evaluate(
                (el,ab) => {
                    return [el.textContent,ab.textContent]
                },
                groupPostsHtmlElements[i],
                groupPostsAuthorHtmlElemments[i]
            );

            // crates a publication object which contains our publication
            var publication = {
                post: postAuthorList[0],
                author: postAuthorList[1]
            };

            // variable indicates if publication exists in allPublicationsList
            var isPublicationExists = false;

            // Check if publication exists in allPublicationsList
            for (var a = 0; a<allPublicationsList.length; a++) {
                var otherPublication = allPublicationsList[a];
                if (
                    (publication.post === otherPublication.post) &&
                    (publication.author === otherPublication.author)
                ) {
                    // If publication exists in allPublictationList
                    isPublicationExists = true;
                    break;
                }
                else {
                    // if publication does not exists in allPublictationList
                    isPublicationExists = false;
                }
            }

            // Once we got the response from the check publication in allPublicationsList
            if (isPublicationExists === false) {
                allPublicationsList.push(publication);
                isAnyNewPosts = true;
            }
        }

        // All html group post elements are added on global publictions list (allPublictionList)
        if (arguments['debug'] === true) {
            console.log('Total posts before scrolling' + allPublicationsList.length);
        }
        // console.log(`Total posts before scrolling ${allPublicationsList.length}`);
        // Both console.log statement above are same


        await autoScroll(page);

    } while (isAnyNewPosts === true)
    console.info( groupName + " Facebook group's posts scraped: " + allPublicationsList.length + ' posts found');
    fs.writeFileSync(
       fileName,
        JSON.stringify(allPublicationsList,undefined,4),
        {encoding: 'utf8'}
    );
// await browser.close();
}

async function main(arguments) {
    if (isUserConfigured() === false) {
        await userConfig();
    }

    const facebookGroupIdList = arguments['group-ids'].split(',')
    const page = await facebookLogIn(arguments);
    // for (var i = 0; i < facebookGroupIdList.length; i++) {
    for (var i = 0; i < 1; i++) {
        const id = facebookGroupIdList[i];
        const groupUrl = generateFacebookGroupUrlFromId(id);
        await facebookMain(arguments, groupUrl,page,id);
    }
}

if (
    fs.existsSync(arguments['output']) === false ||
    fs.lstatSync(arguments['output']).isDirectory() === false
) {
    // output is not exists or not a directory
    error(arguments['output'] + ' does not exists or is not a directory. Please retry with an existing directory path');
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
        console.log("Facebook group scraping done");
    });
} else {
    error('No argument specified. Please check help page for valid arguments');
    help();
    process.exit(1);
}







