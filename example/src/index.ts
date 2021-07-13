import { FB, TwoFARequiredError } from '@makepad/fbjs';
import Post from '../../dist/lib/models/Post';

async function getGroupPosts() {
  const fb = await FB.init({
    groupIds: [],
    useCookies: true,
    disableAssets: true,
    headless: false,
    debug: false,
    output: './',
  }, './cookies.json');
  try {
    await fb.login(
      process.env.FACEBOOK_USERNAME!,
      process.env.FACEBOOK_PASSWORD!,
    );
  } catch (e) {
    if (e instanceof TwoFARequiredError) {
      await fb.enterAuthCode(process.env.FACEBOOK_2FA_CODE!);
    }
  }
  await fb.getGroupPosts(parseInt(process.env.FACEBOOK_GROUP_ID!, 10), undefined, (g: Post) => console.log(g), false);
}

getGroupPosts().then();
