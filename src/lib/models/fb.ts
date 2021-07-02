/* eslint-disable no-await-in-loop */
import puppeteer from 'puppeteer';
import fs from 'fs';
import selectors from '../utils/selectors';
import Options from './options';
import InitialisationError from '../errors/initialisationError';
import {
  // autoScroll,
  generateFacebookGroupURLById,
  getOldPublications,
} from '../utils/fbHelpers';
import GroupPost from './groupPost';
import TwoFARequiredError from '../errors/twoFARequiredError';

export default class Facebook {
  private url = 'https://facebook.com';

  private altUrl = 'https://www.facebook.com';

  private config: Options | undefined;

  private browser: puppeteer.Browser | undefined;

  private page: puppeteer.Page | undefined;

  private cookiesFilePath: string;

  public constructor(
    config: Options,
    browser: puppeteer.Browser,
    page: puppeteer.Page,
    cookiesFileName: string,
  ) {
    this.config = config;
    this.browser = browser;
    this.page = page;
    this.cookiesFilePath = cookiesFileName;
  }

  /**
     * Function initialise the facebook module
     * @param options browser options
     * @param cookiesFilePath The name of the file to save cookies
     */
  public static async init(
    options: Options,
    cookiesFilePath: string = 'fbjs_cookies.json',
  ): Promise<Facebook> {
    const browserOptions: (
      puppeteer.LaunchOptions &
      puppeteer.BrowserLaunchArgumentOptions &
      puppeteer.BrowserConnectOptions &
      {
        product?: puppeteer.Product | undefined;
      }) = {
      headless: options.headless,
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
         *
         */
    const incognitoContext = await browser.createIncognitoBrowserContext();
    // Creates a new borwser tab
    const page = await incognitoContext.newPage();
    if (options.useCookies && fs.existsSync(cookiesFilePath)) {
      const cookiesString = fs.readFileSync(cookiesFilePath);
      const cookies = JSON.parse(cookiesString.toString());
      await page.setCookie(...cookies);
    }
    return new Facebook(options, browser, page, cookiesFilePath);
  }

  /**
     * Function disables the loading of assets to improve performance
     * @private
     */
  private async disableAssets() {
    if (this.page === undefined) {
      throw new InitialisationError();
    }
    await this.page.setRequestInterception(true);
    const blockResources = [
      'image', 'media', 'font', 'textrack', 'object',
      'beacon', 'csp_report', 'imageset',
    ];
    this.page.on('request', (request) => {
      const rt = request.resourceType();
      if (
        blockResources.indexOf(rt) > 0
                || request.url()
                  .match(/\.((jpe?g)|png|gif)/) != null
      ) {
        request.abort();
      } else {
        request.continue();
      }
    });
  }

  /**
   * Function enters the two factor authentication code
   * @param {string} authCode
   */
  public async enterAuthCode(
    authCode: string,
  ) {
    const authCodeInputSelector = '//input[contains(concat(" ", normalize-space(@name), " "), " approvals_code")]';
    const authCodeContinueButtonSelector = '//button[contains(concat(" ", normalize-space(@id), " "), " checkpointSubmitButton")]';
    if (this.page === undefined || this.config === undefined) {
      throw new InitialisationError();
    }
    await this.page.waitForXPath(authCodeInputSelector);
    await (await this.page.$x(authCodeInputSelector))[0].focus();
    await this.page.keyboard.type(authCode);
    await this.page.waitForXPath(authCodeContinueButtonSelector);
    await (await this.page.$x(authCodeContinueButtonSelector))[0].click();
    await this.page.waitForXPath(authCodeContinueButtonSelector);
    await (await this.page.$x(authCodeContinueButtonSelector))[0].click();
    if (this.config.useCookies) {
      const cookies = await this.page.cookies();
      fs.writeFileSync(this.cookiesFilePath, JSON.stringify(cookies, null, 2));
    }
    do {
      await this.page.waitForNavigation({ timeout: 10000000 });
      const u = new URL(this.page.url());
      if (u.pathname === '/') {
        break;
      }
      await this.page.waitForXPath(authCodeContinueButtonSelector);
      await (await this.page.$x(authCodeContinueButtonSelector))[0].click();
    } while (this.page.url() !== this.url && this.page.url() !== this.altUrl);
    if (this.config.disableAssets) {
      await this.disableAssets();
    }
    if (this.config.useCookies) {
      const cookies = await this.page.cookies();
      if (this.cookiesFilePath === undefined) {
        this.cookiesFilePath = 'fbjs_cookies';
      }
      fs.writeFileSync(`./${this.cookiesFilePath}.json`, JSON.stringify(cookies, null, 2));
    }
  }

  /**
   * Function closes everything
   */
  public async close(): Promise<void> {
    this.page?.close();
    this.browser?.close();
  }

  /**
     * Function handles the Facebook login
     * @param username The facebook username
     * @param password The facebook password
     */
  public async login(
    username: string,
    password: string,
  ) {
    if (this.page === undefined || this.config === undefined) {
      throw new InitialisationError();
    }
    // Goes to base facebook url
    await this.page.goto(this.url);
    try {
      await this.page.waitForXPath('//button[@data-cookiebanner="accept_button"]');
      const acceptCookiesButton = (await this.page.$x('//button[@data-cookiebanner="accept_button"]'))[0];
      await this.page.evaluate((el) => {
        el.focus();
        el.click();
      }, acceptCookiesButton);
    } catch {
      // We can not have empty blocks, so we are calling a function which do literally nothing
      (() => {})();
    }

    /**
         * Waiting for login form JQuery selector to avoid
         * that forms elements to be not found
         * */
    await this.page.waitForSelector(selectors.login_form.parent);
    // Focusing to the email input
    await this.page.focus(selectors.login_form.email);
    // Clicking on the email form input to be able to type on input
    await this.page.focus(selectors.login_form.email);
    // Typing on the email input the email address
    await this.page.keyboard.type(username);
    // Focusing on the password input
    await this.page.focus(selectors.login_form.password);
    // Typing the facebook password on password input
    await this.page.keyboard.type(password);
    // Clicking on the submit button
    await this.page.waitForXPath('//button[@data-testid="royal_login_button"]');
    const [loginButton] = await this.page.$x('//button[@data-testid="royal_login_button"]');
    await this.page.evaluate((el) => {
      el.click();
    }, loginButton);
    try {
      await this.page.waitForXPath('//form[contains(concat(" ", normalize-space(@class), " "), " checkpoint")]');
    } catch (e) {
      await this.page.waitForXPath('//div[@data-pagelet="Stories"]');
      if (this.config.disableAssets) {
        await this.disableAssets();
      }
      if (this.config.useCookies) {
        const cookies = await this.page.cookies();
        if (this.cookiesFilePath === undefined) {
          this.cookiesFilePath = 'fbjs_cookies';
        }
        fs.writeFileSync(`./${this.cookiesFilePath}.json`, JSON.stringify(cookies, null, 2));
      }
      return;
    }
    throw new TwoFARequiredError();
  }

  /**
     * Function saves the group posts for the given groupId
     * @param groupId
     */
  public async getGroupPosts(groupId: number, outputFileName: string | undefined) {
    if (this.page === undefined || this.config === undefined) {
      throw new InitialisationError();
    }
    const groupUrl = generateFacebookGroupURLById(groupId);
    let isAnyNewPosts: boolean = false;
    await this.page.goto(
      groupUrl,
      { timeout: 600000 },
    );

    /**
         * Waiting for the group stories container to continue
         * and to avoid the selector not found error
         * */
    // Getting all Facebook group posts

    const groupNameHtmlElement = (await this.page.$x(
      selectors.facebook_group_new.xpath.group_name,
    ))[0];
    let groupName = await this.page.evaluate(
      (el: { textContent: any }) => el.textContent,
      groupNameHtmlElement,
    );

    groupName = groupName.replace(/\//g, '_');
    if (outputFileName === undefined) {
      // eslint-disable-next-line no-param-reassign
      outputFileName = `${this.config.output + groupName}.json`;
    }
    const allPublicationsList = getOldPublications(outputFileName);
    console.log(groupName);

    // List contains all publications
    // Variable indicates if any new posts found on the page
    do {
      // eslint-disable-next-line no-var
      isAnyNewPosts = false;
      await this.page.waitForXPath(
        selectors.facebook_group_new.xpath.group_feed_container
        + selectors.facebook_group_new.xpath.group_post_div,
      );
      console.log(
        selectors.facebook_group_new.xpath.group_feed_container
        + selectors.facebook_group_new.xpath.group_post_div,
      );
      const groupPostsHtmlElements = await this.page.$x(
        selectors.facebook_group_new.xpath.group_feed_container
        + selectors.facebook_group_new.xpath.group_post_div,
      );
      /* const groupPostsAuthorHtmlElemments = await this.page.$x(
        '((//article/div[@class="story_body_container"])'
                + '[child::div])/header//strong[1]',
      ); */

      // Looping on each group post html elemen to get text and author
      /* for (let i = 0; i < groupPostsAuthorHtmlElemments.length; i += 1) {
        const [postAuthorName, postTextContent] = await this.page.evaluate(
          (el: any, eb: any): any => [el.textContent, eb.textContent],
          groupPostsAuthorHtmlElemments[i],
          groupPostsHtmlElements[i],
        );
        await groupPostsAuthorHtmlElemments[i]
          .$x('//article/div[@class="story_body_container"]//span[1]/p'); */

      for (let i = 0; i < groupPostsHtmlElements.length; i += 1) {
        const [postTextContent] = await this.page.evaluate(
          (el: any): any => [el.textContent],
          groupPostsHtmlElements[i],
        );

        // crates a publication object which contains our publication
        const publication: GroupPost = {
          post: postTextContent,
          // author: postTextContent,
        };
        console.log(publication);
        // variable indicates if publication exists in allPublicationsList
        let isPublicationExists = false;

        // Check if publication exists in allPublicationsList
        for (let a = 0; a < allPublicationsList.length; a += 1) {
          const otherPublication = allPublicationsList[a];
          if (
            (publication.post === otherPublication.post)
          // && (publication.author === otherPublication.author)
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
      console.log('isAnyNewPosts: ', isAnyNewPosts);
      // await this.page.evaluate(autoScroll);
    } while (isAnyNewPosts === true);
    fs.writeFileSync(
      outputFileName,
      JSON.stringify(allPublicationsList, undefined, 4),
      { encoding: 'utf8' },
    );
    // await browser.close();
  }
}
