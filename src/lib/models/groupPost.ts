export default interface GroupPost {
  authorName: string,
  authorUrl: string | null,
  authorAvatar: string,
  date: string,
  permalink: string,
  id: string,
  contentText: string | null,
  contentHtml: string | null
}
