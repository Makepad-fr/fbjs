export default interface Post {
  authorName: string,
  authorUrl: string | null,
  authorAvatar: string | null,
  date: string,
  permalink: string,
  id: string,
  contentText: string | null,
  contentHtml: string | null,
  images: any[]
}
