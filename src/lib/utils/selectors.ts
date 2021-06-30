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
    group_feed_container: 'div[role=feed]',
    group_post_div: 'div[role=article][aria-labelledby]',
    group_post_header: 'div[role=article][aria-labelledby] > div > div > div > div > div > :not(div:empty) > div > :not(div:empty)',
    group_post_author: 'strong span a',
    group_post_author_avatar: 'image',
    group_post_link: 'span span span a',
    group_post_content: 'div[dir=auto][class]',
    group_post_content_expand_button: 'div[role=button]',
    group_post_attachment: 'div[dir=auto][class] + div',
    group_post_video: 'video',
    group_post_img: 'img',
  }
};
