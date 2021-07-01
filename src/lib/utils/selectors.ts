export default {
  login_form: {
    email: 'input#email',
    password: 'input[type="password"]',
    submit: 'button[data-testid="royal_login_button"]',
    parent: 'form',
  },
  facebook_group: {
    m_group_stories_container: '#m_group_stories_container',
    m_group_post_div: '#m_group_stories_container .storyStream article',
    m_group_story_container: '#m_group_stories_container .storyStream article .story_body_container',
  },
  facebook_group_new: {
    css: {
      group_name: 'html > head > title',
      group_feed_container: 'div[role=feed]',
      group_post_div: 'div[role=article][aria-labelledby]',
      group_post_author: 'h2 span a',
      group_post_author_avatar: 'object image',
      group_post_link: 'span[dir=auto] > span a',
      group_post_content: 'div[dir=auto][class]',
      group_post_content_expand_button: 'div[role=button]',
      group_post_attachment: 'div[dir=auto][class] + div[class][id]',
      group_post_video: 'video',
      group_post_img: 'img',
    },
    xpath: {
      group_name: '/html/head/title',
      group_feed_container: '//div[@role="feed"]"',
      group_post_div: '//div[@role="article"][@aria-labelledby]',
      group_post_author: '//h2//span//a',
      group_post_author_avatar: '//object//*[name()="image"]',
      group_post_link: '//span[@dir="auto"]/span//a',
      group_post_content: '//div[@dir="auto"][@class]',
      group_post_content_expand_button: '//div[@role="button"]',
      group_post_attachment:'//div[@role]//div[@role="article"][@aria-labelledby]//div[@dir="auto"][@class]//following::div[1][@class][@id]',
      group_post_video: '//video',
      group_post_img: '//img'
    }
  }
};
