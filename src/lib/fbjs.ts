/* eslint-disable no-await-in-loop */
import puppeteer from 'puppeteer'
import * as fs from 'fs';
import selectors from './utils/selectors';
import Options from './models/options';
import Configuration from './models/configuration';

/**
* Function handles the validation of a string.
* @namespace validator
* @param {string} input the input parameter to validate
* @return {bool} returns true if the given input is valid
* */
function validator(input: string | any[]) {
  return input.length !== 0;
}

/**
     * Function pauses the main execution for given number of seconds
     * @param duration The sleep duration
     */
async function sleep(duration: number): Promise<void> {
  return new Promise(((resolve) => {
    setTimeout(resolve, duration);
  }));
}

/**
 * Function generates the group URL from the given group id
 * @param groupId The id of the facebook group to generate the id
 * @returns {string} The generated group URL
 */
function generateGroupUrlFromId(groupId: string): string {
  return `https://m.facebook.com/groups/${groupId}/`;
}

/**
 * Function automatically infinite scrolls and sleeps
 */
async function autoScroll(): Promise<void> {
  for (let i = 0; i < Math.round((Math.random() * 10) + 10); i += 1) {
    window.scrollBy(0, document.body.scrollHeight);
    // eslint-disable-next-line no-await-in-loop
    await sleep(
      Math.round(
        (Math.random() * 4000) + 1000,
      ),
    );
  }
  Promise.resolve();
}

/**
* function creates a browser instance.
* @namespace createBrowser
* @param {Object} args Comamnd line arguments parsed from user input
* @return {Browser} returns the Browser object
* */
async function createBrowser(args: Options): Promise<puppeteer.Browser> {
  const browserOptions: (
    puppeteer.LaunchOptions &
    puppeteer.BrowserLaunchArgumentOptions &
    puppeteer.BrowserConnectOptions &
    {
      product?: puppeteer.Product | undefined;
    }) = {
    headless: args.headful === false,
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
* */
async function incognitoMode(browser: puppeteer.Browser): Promise<puppeteer.Page> {
  /**
     * We need an incognito browser to avoid notification
     *  and location permissions of Facebook
     * */
  const incognitoContext = await browser.createIncognitoBrowserContext();
  // Creates a new borwser tab
  const page = await incognitoContext.newPage();
  return page;
}

/**
* Function sets the listeners to avoid to load unnecessary content.
* @namespace setPageListeners
* @param {Page} page The current page of the browser
* @return {void} returns nothing but configures listeners on the given
 page to avoid to load
* unnecessart content
* */
async function setPageListeners(page: puppeteer.Page) {
  await page.setRequestInterception(true);
  const blockResources = [
    'image', 'media', 'font', 'textrack', 'object',
    'beacon', 'csp_report', 'imageset',
  ];
  page.on('request', (request) => {
    const rt = request.resourceType();
    if (
      blockResources.indexOf(rt) > 0
              || request.url().match(/\.((jpe?g)|png|gif)/) != null
    ) {
      request.abort();
    } else {
      request.continue();
    }
  });
}

/**
* Function handles the Frabook login of the user.
* @namespace facebookLogin
* @param {Options} args command line arguments parsed with minimist
* @param {Page} page the incognito page that we are using for login
* @param {async (arg0: puppeteer.Page) => Promise<void>} setter the function that sets the
page listeners to speed up
* @return {Page} returns the page when the user logged in
* */
async function facebookLogIn(
  args:Options,
  page: puppeteer.Page,
  setter: (arg0: puppeteer.Page) => Promise<void>,
  config: Configuration,
) {
  // Goes to base facebook url
  await page.goto('https://facebook.com');
  await page.waitForXPath('//button[@data\-cookiebanner="accept_button"]');
  const acceptCookiesButton = (await page.$x('//button[@data\-cookiebanner="accept_button"]'))[0];
  await page.evaluate((el) => {
    el.focus();
    el.click();
  }, acceptCookiesButton);
  /**
     * Waiting for login form JQuery selector to avoid
     * that forms elements to be not found
    * */
  await page.waitForSelector(selectors.login_form.parent);
  // Focusing to the email input
  await page.focus(selectors.login_form.email);
  // Clicking on the email form input to be able to type on input
  await page.focus(selectors.login_form.email);
  // Typing on the email input the email address
  await page.keyboard.type(config.username);
  // Focusing on the password input
  await page.focus(selectors.login_form.password);
  // Typing the facebook password on password input
  await page.keyboard.type(config.password);
  // Clicking on the submit button
  await page.waitForXPath('//button[@data\-testid="royal_login_button"]');
  const [loginButton] = await page.$x('//button[@data\-testid="royal_login_button"]');
  await page.evaluate((el) => {
    el.click();
  }, loginButton);
  await page.waitForXPath('//div[@data\-pagelet="Stories"]');
  await setter(page);
  return page;
}

/**
* Function gets old publications.
* @namespace getOldPublications
* @param {type} fileName name of the file
* @return {Object[]} returns the list of all publications.
* */
function getOldPublications(fileName: string): object[] {
  let allPublicationsList;
  if (fs.existsSync(fileName) === true) {
    // If file exists
    allPublicationsList = JSON.parse(
      fs.readFileSync(fileName, { encoding: 'utf8' }),
    );
  } else {
    // If file does not exists
    allPublicationsList = [];
  }
  return allPublicationsList;
}

/**
* Function handles the main execution of the Facebook bot.
* @namespace facebookMain
* @param {Object} args Command line arguments parsed with minimist
* @param {string} groupUrl The url of the Facebook group
* @param {Page} page The actual page of browser
* @param {string} id The id of the facebook group
* @param {getOldPublicationsCallback} getOldPublicationsCallback The function used for
loading the older publications
* @param {autoScrollFunction} autoScrollCallback The function used for
scrolling automatically
* @param {sleepFunctionCallback} sleepCallback The sleep function that
 we use in autoScroll
* @return {void} returns nothing but scrape all questions from specific groups
* */
async function facebookMain(
  args: Options,
  groupUrl: any,
  page: puppeteer.Page,
  id: any,
  getOldPublicationsCallback: (arg0: string) => any,
  autoScrollCallback: (arg0: any, arg1: any) => any,
  sleepCallback: any,
): Promise<void> {
  let isAnyNewPosts: boolean = false;
  // Navigates to the first facebook group Türk Ögrenciler - Paris
  await page.goto(
    groupUrl,
    { timeout: 600000 },
  );

  /**
   * Waiting for the group stories container to continue
   * and to avoid the selector not found error
  * */
  // Getting all Facebook group posts

  const groupNameHtmlElement = (await page.$x('/html/head/title'))[0];
  let groupName = await page.evaluate(
    (el: { textContent: any }) => el.textContent,
    groupNameHtmlElement,
  );
  if (args.debug === true) {
    console.log(`Group title ${groupName}`);
  }

  groupName = groupName.replace(/\//g, '_');
  const fileName = `${args.output + groupName}.json`;

  const allPublicationsList = getOldPublicationsCallback(fileName);

  // List contains all publications
  // Variable indicates if any new posts found on the page
  do {
    if (args.debug === true) {
      console.log(`Total posts before scraping ${allPublicationsList.length}`);
    }
    // eslint-disable-next-line no-var
    isAnyNewPosts = false;
    await page.waitForXPath(
      '//article/div[@class="story_body_container"]',
    );
    const groupPostsHtmlElements = await page.$x(
      '//article/div[@class="story_body_container"]/div[1]',
    );
    const groupPostsAuthorHtmlElemments = await page.$x(
      '((//article/div[@class="story_body_container"])'
        + '[child::div])/header//strong[1]',
    );

    // Looping on each group post html elemen to get text and author
    for (let i = 0; i < groupPostsAuthorHtmlElemments.length; i += 1) {
      const [postAuthorName, postTextContent] = await page.evaluate(
        (el: any, eb: any): any => [el.textContent, eb.textContent],
        groupPostsAuthorHtmlElemments[i],
        groupPostsHtmlElements[i],
      );
      await groupPostsAuthorHtmlElemments[i]
        .$x('//article/div[@class="story_body_container"]//span[1]/p');

      // crates a publication object which contains our publication
      const publication = {
        post: postAuthorName,
        author: postTextContent,
      };

      // variable indicates if publication exists in allPublicationsList
      let isPublicationExists = false;

      // Check if publication exists in allPublicationsList
      for (let a = 0; a < allPublicationsList.length; a += 1) {
        const otherPublication = allPublicationsList[a];
        if (
          (publication.post === otherPublication.post)
                    && (publication.author === otherPublication.author)
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
      * */
      if (isPublicationExists === false) {
        allPublicationsList.push(publication);
        isAnyNewPosts = true;
      }
    }

    /**
     * All html group post elements are added on
     * global publictions list (allPublictionList)
     * */
    if (args.debug === true) {
      console.log(`Total posts before scrolling${allPublicationsList.length}`);
    }
    /**
     *  console.log(`Total posts before
     * scrolling ${allPublicationsList.length}`);
    * */
    // Both console.log statement above are same

    await autoScrollCallback(page, sleepCallback);
  } while (isAnyNewPosts === true);
  console.info(
    `${groupName
    } Facebook group's posts scraped: ${
      allPublicationsList.length
    } posts found`,
  );
  fs.writeFileSync(
    fileName,
    JSON.stringify(allPublicationsList, undefined, 4),
    { encoding: 'utf8' },
  );
// await browser.close();
}

/**
* Function handles the main process of the scraper
* @namespace main
* @param {Object} args arguments parsed from command line with minimist
* @param {askQuestionsFunctionCallback} askQuestionsFunction
The function used for asking questions to user configuration
* @param {validatorFunctionCallback} validatorCallback The function used for
validate user answsers
* @param {createBrowserCallback} createBrowserCallback function that creates the browser
* @param {incognitoModeCallback} incognitoModeCallback function creates an
incognito mode from the given browser
* @param {setPageListenersCallback} setPageListenersCallback function sets the page
* listeners on the given page
* @param {generateFacebookGroupUrlFromIdCallback} generateFacebookGroupUrlFromId
function sets the page
* listeners on the given page
* @param {facebookMainCallback} facebookMainCallback The main function used for
 scraping data from facebook
* @param {getOldPublicationsCallback} getOldPublicationsCallback The function
 used for loading old publications
* @param {autoScrollCallback} autoScrollCallback The function used for auto scrolling
* @param {sleepFunctionCallback} sleepCallback The function used for
sleeping the current process
* @return {void} returns nothing but calls the FacebookMain
* function for each groupId once logged in
* */
async function main(
  args: Options,
  config: Configuration,
  validatorCallback: (input: string | any[]) => boolean,
  createBrowserCallback: { (args: Options): Promise<puppeteer.Browser>; (arg0: any): any; },
  incognitoModeCallback: {
    (browser: puppeteer.Browser): Promise<puppeteer.Page>;
    (arg0: any): any;
  },
  setPageListenersCallback: {
    (page: puppeteer.Page): Promise<void>;
    (arg0: puppeteer.Page): Promise<void>;
  },
  generateFacebookGroupUrlFromId: (arg0: any) => any,
  facebookMainCallback: Function,
  getOldPublicationsCallback: (fileName: string) => object[],
  autoScrollCallback: () => Promise<void>,
  sleepCallback: (duration: number) => Promise<void>,
) {
  const facebookGroupIdList = args.groupIds;
  const browser = await createBrowserCallback(args);
  let page = await incognitoModeCallback(browser);
  await page
    .setUserAgent(
      'User agent Mozilla/5.0 (Macintosh; Intel Mac OS X 10_16_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.0 Safari/537.36',
    );
  page = await facebookLogIn(args, page, setPageListenersCallback, config);
  // for (var i = 0; i < facebookGroupIdList.length; i++) {
  for (let i = 0; i < facebookGroupIdList.length; i += 1) {
    const id = facebookGroupIdList[i];
    const groupUrl = generateFacebookGroupUrlFromId(id);
    await facebookMainCallback(
      args,
      groupUrl,
      page,
      id,
      getOldPublicationsCallback,
      autoScrollCallback,
      sleepCallback,
    );
  }
  await browser.close();
}

export default (args: Options, config: Configuration) => main(
  args,
  config,
  validator,
  createBrowser,
  incognitoMode,
  setPageListeners,
  generateGroupUrlFromId,
  facebookMain,
  getOldPublications,
  autoScroll,
  sleep,
);
