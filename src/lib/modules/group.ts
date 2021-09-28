import { ElementHandle, Page } from 'puppeteer';
import fs from 'fs';
import Initialisation_error from '../errors/initialisation_error';
import {
  autoScroll, generateFacebookGroupURLById, getOldPublications, promiseTimeout,
} from '../utils/fb_helpers';
import selectors from '../utils/selectors';
import Options from '../models/options';
import Post from '../models/post';

export default class Group {
  private page: Page;

  private config: Options;

  private url: string;

  private id: number;

  constructor(page: Page, config: Options, id: number) {
    this.page = page;
    this.config = config;
    this.id = id;
    this.url = generateFacebookGroupURLById(id);
  }

  /**
   * Function saves the group posts for the given groupId
   * @param groupId
   * @param outputFileName
   */
  public async getPosts(
    outputFileName?: string,
    callback?: (arg0: Post) => void,
    save: boolean = true,
  ) {
    // Go to the group page
    await this.page.goto(
      this.url,
      {
        timeout: 600000,
      },
    );

    /**
     * Waiting for the `group_name` selector to continue
     * and to avoid the selector not found error.
     * */
    await this.page.waitForSelector(selectors.facebook_group.group_name);

    // Extract the group name
    const groupNameElm = await this.page.$(selectors.facebook_group.group_name);
    const groupName = await this.page.evaluate(
      (el: { textContent: any }) => el.textContent,
      groupNameElm,
    );
    console.log(groupName);

    if (!outputFileName) {
      // eslint-disable-next-line no-param-reassign
      outputFileName = `${this.config.output + this.id}.json`;
    }

    /**
     * Save post to the database
     * @param postData
     */
    const savePost = (postData: Post): void => {
      const allPublicationsList = getOldPublications(outputFileName!);
      allPublicationsList.push(postData);
      fs.writeFileSync(
        outputFileName!,
        JSON.stringify(allPublicationsList, undefined, 4),
        { encoding: 'utf8' },
      );
    };

    /**
     * Scroll down a little bit to load posts.
     * The `hover()` method located in `parsePost()` will continue scrolling
     * automatically over posts all the way down, so we only need to execute this once.
     * To ensure that it will work we need a small delay after the page finishes loading,
     * waiting for the "group_name" selector will provide us that delay.
     * */
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
     * This will ensure that it won't run the function
     * `handlePosts` more than once in the same time.
     * */
    let busy = false;

    /**
     * Handle new added posts
     * @param force
     */
    const handlePosts = async (force: boolean): Promise<void> => {
      if (busy && !force) return;
      busy = true;
      const postHnd = await this.page?.evaluateHandle(
        () => window.posts.shift(),
      );
      if (postHnd?.toString() !== 'JSHandle:undefined') {
        const postData = await this.parsePost(<ElementHandle>postHnd);
        if (callback) callback(postData);
        if (save) savePost(postData);
        handlePosts(true);
      } else {
        busy = false;
      }
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
              handlePosts(false);
            }
          }
        }
      });
      observer.observe(target, { childList: true });
    }, selectors);
  }

  /**
   * Extract data from a post
   * @param post
   */
  private async parsePost(postHnd: ElementHandle) {
    if (this.page === undefined || this.config === undefined) {
      throw new Initialisation_error();
    }

    /**
     * Get post metadata
     * @returns date, permalink, id
     */
    const getPostMetadata = async (): Promise<any> => {
      /**
       * We need to hover over that element to load the post permalink
       * and to grab the post date (annoying stuff).
       * Moving the mouse or scrolling or minimizing the window will prevent
       * the script from hovering and this will cause errors, because of that
       * we recommend users to run the scraper under the headless mode.
       * */
      const postLinkHnd = await postHnd.$(
        selectors.facebook_post.post_link,
      );

      // Reset cursor locaion
      try {
        await promiseTimeout(this.page?.mouse.move(0, 0)!, 200);
      } catch (err: any) {
        console.error('Move: ', err.message);
        return await getPostMetadata();
      }

      // Hover
      try {
        await promiseTimeout(postLinkHnd!.hover(), 200);
      } catch (err: any) {
        console.error('Hover: ', err.message);
        if (err.message === 'Node is either not visible or not an HTMLElement') {
          await new Promise((res) => setTimeout(res, 1000));
        }
        return await getPostMetadata();
      }

      // Grab the metadata
      let data;
      try {
        data = await promiseTimeout(
          this.page?.evaluate(
            async (postLinkElm: HTMLElement) => {
              const span = postLinkElm.parentElement!;
              let date;
              let permalink;
              let id;
              await new Promise<void>((res, rej) => {
                const observer = new MutationObserver(
                  () => {
                    observer.disconnect();
                    const tooltipID = span.getAttribute('aria-describedby')!;
                    const tooltip = document.getElementById(tooltipID);
                    if (!tooltip) return rej(new Error('Tooltip not found!'));
                    date = tooltip.innerText;
                    permalink = postLinkElm.getAttribute('href')!.replace(/(\/\?.+)$/, '');
                    id = permalink.replace(/^.+\//, '');
                    return res();
                  },
                );
                observer.observe(span, { attributes: true, attributeFilter: ['aria-describedby'] });
                setTimeout(() => observer.disconnect(), 1000);
              });
              return {
                date,
                permalink,
                id,
              };
            },
            postLinkHnd,
          )!,
          1000,
        );
      } catch (err: any) {
        console.error('data: ', err.message);
        return await getPostMetadata();
      }
      return data;
    };

    const postMetadata = await getPostMetadata();

    // Grab other data
    const postData = await this.page.evaluate(
      async (postElm: HTMLElement, cssSelectors: typeof selectors) => {
        // Not all posts provide the author profile url
        let authorElm = <HTMLElement>postElm.querySelector(
          cssSelectors.facebook_post.post_author,
        );
        let authorName;
        let authorUrl;
        if (authorElm) {
          authorName = authorElm.innerText;
          authorUrl = authorElm.getAttribute('href')!.replace(/(\/?\?.+)$/, '');
        } else {
          authorElm = <HTMLElement>postElm.querySelector(
            cssSelectors.facebook_post.post_author2,
          );
          authorName = authorElm.innerText;
          authorUrl = null;
        }

        /**
         * Also, not all posts provide the author avatar.
         * You should authenticate to get rid of these limitations.
         * */
        const authorAvatarElm = <HTMLElement>postElm.querySelector(
          cssSelectors.facebook_post.post_author_avatar,
        );
        let authorAvatar;
        if (authorAvatarElm) {
          authorAvatar = authorAvatarElm.getAttribute('xlink:href')!;
        } else {
          authorAvatar = null;
        }

        // Some posts don't have text, so they won't have contentElm
        const contentElm = <HTMLElement>postElm.querySelector(
          cssSelectors.facebook_post.post_content,
        );
        let contentText;
        let contentHtml;
        if (contentElm) {
          // We should click the "See More..." button before extracting the post content
          const expandButton = <HTMLElement>contentElm.querySelector(
            cssSelectors.facebook_post.post_content_expand_button,
          );
          if (expandButton) {
            await new Promise<void>((res) => {
              const observer = new MutationObserver(
                () => {
                  observer.disconnect();
                  contentText = contentElm.innerText;
                  contentHtml = contentElm.innerHTML;
                  res();
                },
              );
              observer.observe(contentElm, { childList: true, subtree: true });
              expandButton.click();
            });
          } else {
            contentText = contentElm.innerText;
            contentHtml = contentElm.innerHTML;
          }
        } else {
          contentText = null;
          contentHtml = null;
        }

        // Some posts don't have attachments, so they won't have attachmentElm
        const attachmentElm = <HTMLElement>postElm.querySelector(
          contentElm
            ? cssSelectors.facebook_post.post_attachment
            : cssSelectors.facebook_post.post_attachment2,
        );

        const images: any[] = [];
        if (attachmentElm) {
          const imgElms = Array.from(
            attachmentElm.querySelectorAll(cssSelectors.facebook_post.post_img),
          );
          imgElms.forEach((imgElm) => {
            const src = imgElm.getAttribute('src');
            images.push(src);
          });
        }

        return {
          authorName,
          authorUrl,
          authorAvatar,
          contentText,
          contentHtml,
          images,
        };
      },
      postHnd, selectors,
    );

    // crates a post object which contains our post
    const groupPost: Post = {
      authorName: <string>postData.authorName,
      authorUrl: <string | null>postData.authorUrl,
      authorAvatar: <string | null>postData.authorAvatar,
      date: <string>postMetadata.date,
      permalink: <string>postMetadata.permalink,
      id: <string>postMetadata.id,
      contentText: <string | null>postData.contentText,
      contentHtml: <string | null>postData.contentHtml,
      images: <any[]>postData.images,
    };

    return groupPost;
  }
}
