export default {
  login_form: {
    email: 'input#email',
    password: 'input[type="password"]',
    submit: 'button[data-testid="royal_login_button"]',
    parent: 'form',
  },
  facebook_group: {
    group_name: 'title',
    group_feed_container: 'div[role=feed]',
  },
  facebook_post: {
    post_element: 'div[role=article][aria-labelledby]',
    post_author: 'h2 span a',
    post_author2: 'h2 strong span',
    post_author_avatar: 'object image',
    post_link: 'span[dir=auto] > span a',
    post_content: 'div[dir=auto][class]',
    post_content_expand_button: 'div[role=button]',
    post_attachment: 'div[dir=auto][class] + div[class][id]',
    post_attachment2: 'div[class][id]',
    post_video: 'video',
    post_img: 'img',
  },
};
