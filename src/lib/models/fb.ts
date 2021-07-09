/* eslint-disable no-await-in-loop */
import puppeteer, { ElementHandle } from 'puppeteer';
import fs from 'fs';
import selectors from '../utils/selectors';
import Options from './options';
import InitialisationError from '../errors/initialisationError';
import {
  autoScroll,
  generateFacebookGroupURLById,
  getOldPublications,
} from '../utils/fbHelpers';
import GroupPost from './groupPost';
import TwoFARequiredError from '../errors/twoFARequiredError';

declare global {
  interface Window {
    posts: HTMLElement[];
  }
}

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
     * and location permissions of Facebook
     *
     */
    const incognitoContext = await browser.createIncognitoBrowserContext();
    // Creates a new borwser tab
    const page = await incognitoContext.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/68.0.3419.0 Safari/537.36');

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
      fs.writeFileSync(`./${this.cookiesFilePath.replace(/\.json$/g,'')}.json`, JSON.stringify(cookies, null, 2));
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
        fs.writeFileSync(`./${this.cookiesFilePath.replace(/\.json$/g, '')}.json`, JSON.stringify(cookies, null, 2));
      }
      return;
    }
    throw new TwoFARequiredError();
  }

  /**
   * Function saves the group posts for the given groupId
   * @param groupId
   * @param outputFileName
   */
  public async getGroupPosts(groupId: number, outputFileName: string | undefined) {
    if (this.page === undefined || this.config === undefined) {
      throw new InitialisationError();
    }
    const groupUrl = generateFacebookGroupURLById(groupId);
    await this.page.goto(
      groupUrl,
      {
        timeout: 600000,
        waitUntil: 'domcontentloaded',
      },
    );

    const groupNameElm = await this.page.$(selectors.facebook_group.group_name);
    let groupName = await this.page.evaluate(
      (el: { textContent: any }) => el.textContent,
      groupNameElm,
    );
    console.log(groupName);

    // The validation here is much complicated than just replacing a slash with an underscore
    groupName = groupName.replace(/\//g, '_');
    if (outputFileName === undefined) {
      // eslint-disable-next-line no-param-reassign
      outputFileName = `${this.config.output + groupName}.json`;
    }

    /**
     * Save post to the database
     * @param postData
     */
    const savePost = (postData: GroupPost): void => {
      const allPublicationsList = getOldPublications(outputFileName!);
      allPublicationsList.push(postData);
      fs.writeFileSync(
        outputFileName!,
        JSON.stringify(allPublicationsList, undefined, 4),
        { encoding: 'utf8' },
      );
    };

    // Start Scrolling!
    this.page.evaluate(autoScroll);

    /**
     * Waiting for the group feed container to continue
     * and to avoid the selector not found error.
     * Note that we ignore any posts outside this container
     * specifically announcements, because they don't follow
     * the same sorting method as the others.
     * */
    await this.page.waitForSelector(
      selectors.facebook_group.group_feed_container,
    );

    /**
     * Handle new added posts
     */
    const handlePosts = async () => {
      const post = await this.page?.evaluateHandle(
        () => window.posts.shift(),
      );
      const postData = await this.parsePost(<ElementHandle>post);
      console.log(postData);
      savePost(postData);
    };
    this.page.exposeFunction('handlePosts', handlePosts);

    // Listen to new added posts
    this.page.evaluate((cssSelectors: typeof selectors) => {
      window.posts = [];
      const target = <HTMLElement>document.querySelector(
        cssSelectors.facebook_group.group_feed_container,
      );
      const observer = new MutationObserver((mutations) => {
        for (let i = 0; i < mutations.length; i += 1) {
          for (let j = 0; j < mutations[i].addedNodes.length; j += 1) {
            const addedNode = <HTMLElement>mutations[i].addedNodes[j];
            const postElm = <HTMLElement>addedNode.querySelector(
              cssSelectors.facebook_post.post_element,
            );
            if (postElm) {
              window.posts.push(postElm);
              handlePosts();
            }
          }
        }
      });
      observer.observe(target, { childList: true });
    }, selectors);
  }

  /**
   * Extract data from a group post
   * @param post
   */
  public async parsePost(post: ElementHandle) {
    if (this.page === undefined || this.config === undefined) {
      throw new InitialisationError();
    }

    const { authorName, content } = await this.page.evaluate(
      async (postElm: HTMLElement, cssSelectors: typeof selectors): Promise<any> => {
        let postAuthorElm;
        postAuthorElm = <HTMLElement>postElm.querySelector(
          cssSelectors.facebook_post.post_author,
        );
        let postAuthorName;
        // Not all posts provide author profile url
        if (postAuthorElm) {
          postAuthorName = postAuthorElm.innerText;
        } else {
          postAuthorElm = <HTMLElement>postElm.querySelector(
            cssSelectors.facebook_post.post_author2,
          );
          postAuthorName = postAuthorElm.innerText;
        }

        const postContentElm = <HTMLElement>postElm.querySelector(
          cssSelectors.facebook_post.post_content,
        );
        let postContent;
        // Some posts don't have text, so they won't have postContentElm
        if (postContentElm) {
          // We should click the "See More..." button before extracting the post content
          const expandButton = <HTMLElement>postContentElm.querySelector(
            cssSelectors.facebook_post.post_content_expand_button,
          );
          if (expandButton) {
            postContent = await new Promise((res) => {
              const observer = new MutationObserver(
                () => {
                  observer.disconnect();
                  res(postContentElm.innerText);
                },
              );
              observer.observe(postContentElm, { childList: true, subtree: true });
              expandButton.click();
            });
          } else {
            postContent = postContentElm.innerText;
          }
        } else {
          postContent = '';
        }

        return {
          authorName: postAuthorName,
          content: postContent,
        };
      },
      post, selectors,
    );

    // crates a submission object which contains our submission
    const submission: GroupPost = {
      author: authorName,
      post: content,
    };

    return submission;
  }
}
