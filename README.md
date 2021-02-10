# Facebook Group Posts Scraper 
<!-- ALL-CONTRIBUTORS-BADGE:START - Do not remove or modify this section -->
[![All Contributors](https://img.shields.io/badge/all_contributors-1-orange.svg?style=flat-square)](#contributors-)
<!-- ALL-CONTRIBUTORS-BADGE:END -->

Facebook Group Posts Scraper is a package which is used for scraping facebook group posts by their group ids.

## Getting Started - Installation

```sh
npm i facebook-group-posts-scraper -g --unsafe-perm
fgps init
```
## Usage

To scrape posts from group accessible by URL facebook.com/groups/some_group/:

```sh
fgps --group-ids some_group --output /some/output/dir
```

For many groups at once:
```sh
fgps --group-ids some_group1,some_group2,some_group3 --output /some/output/dir
```

## Command-line options
 
- `fgps -h/--help`    - Shows the help page.
- `fgps -v/--version` - Shows the CLI version.
- `fgps --output`     - Specify the output folder destination.
- `fgps --headful`    - Disable headless mode.
- `fgps init`         - Initialize user configuration.
- `fgps --group-ids`  - Indicates which groups ids that we want to scrape (seperated by commas).

## Contributors ✨

Thanks goes to these wonderful people ([emoji key](https://allcontributors.org/docs/en/emoji-key)):

<!-- ALL-CONTRIBUTORS-LIST:START - Do not remove or modify this section -->
<!-- prettier-ignore-start -->
<!-- markdownlint-disable -->
<table>
  <tr>
    <td align="center"><a href="https://grzegorzkowalski.pl/"><img src="https://avatars.githubusercontent.com/u/1021798?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Grzegorz Adam Kowalski</b></sub></a><br /><a href="https://github.com/Makepad-fr/fbjs/commits?author=gakowalski" title="Code">💻</a> <a href="https://github.com/Makepad-fr/fbjs/commits?author=gakowalski" title="Documentation">📖</a> <a href="https://github.com/Makepad-fr/fbjs/issues?q=author%3Agakowalski" title="Bug reports">🐛</a></td>
  </tr>
</table>

<!-- markdownlint-restore -->
<!-- prettier-ignore-end -->

<!-- ALL-CONTRIBUTORS-LIST:END -->

This project follows the [all-contributors](https://github.com/all-contributors/all-contributors) specification. Contributions of any kind welcome!