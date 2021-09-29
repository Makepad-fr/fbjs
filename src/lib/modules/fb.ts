/* eslint-disable no-await-in-loop */
import fs from 'fs';
import puppeteer, { Browser, Page } from 'puppeteer';
import selectors from '../utils/selectors';
import Options from '../models/options';
import InitialisationError from '../errors/initialisation_error';

import TwoFARequiredError from '../errors/two_fa_required_error';
import Group from './group';
import { acceptCookies } from '../utils/fb_helpers';

declare global {
  interface Window {
    posts: HTMLElement[];
  }
}

export default class Facebook {
  private url = 'https://facebook.com';

  private altUrl = 'https://www.facebook.com';

  private config: Options;

  private browser: Browser;

  private readonly page: Page;

  private cookiesFilePath: string;

  private g: Group | undefined;

  private constructor(
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
    await this.saveCookies();
  }

  /**
   * Function closes everything
   */
  public async close() {
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

    // Accept cookies if needed
    await acceptCookies(this.page);

    await this.completeLoginForm(username, password);
    if (await this.checkFor2FA()) {
      throw new TwoFARequiredError();
    }
    await this.page.waitForXPath('//div[@data-pagelet="Stories"]');
    if (this.config.disableAssets) {
      await this.disableAssets();
    }
    await this.saveCookies();
  }

  /**
   * Function sets the group id for the Bot
   * @param id The id of the group
   * @return Group The current group related to the scraper
   */
  public group(id: number): Group {
    this.g = new Group(this.page, this.config, id);
    return this.g;
  }

  /**
   * Function tests if the 2FA input appeared
   * @return true if 2FA banner is appeared, false if not
   * @private
   */
  private async checkFor2FA(): Promise<boolean> {
    try {
      await this.page.waitForXPath('//form[contains(concat(" ", normalize-space(@class), " "), " checkpoint")]');
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * Function completes the login form
   * @param username The username to write in the username field
   * @param password The password to write in the password field
   * @private
   */
  private async completeLoginForm(username: string, password: string) {
    await this.page.waitForSelector(selectors.login_form.parent);
    // Focusing to the email input
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
    await loginButton.click();
  }

  /**
   * Function saves cookies if configuration enables the usage of cookies.
   * @private
   */
  private async saveCookies() {
    if (this.config.useCookies) {
      const cookies = await this.page.cookies();
      if (this.cookiesFilePath === undefined) {
        this.cookiesFilePath = 'fbjs_cookies';
      }
      fs.writeFileSync(`./${this.cookiesFilePath.replace(/\.json$/g, '')}.json`, JSON.stringify(cookies, null, 2));
    }
  }
}
