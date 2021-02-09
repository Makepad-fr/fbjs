# Facebook Group Posts Scraper 

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

App will output hundreds of `i=xxx` lines on the screen and finally a data files will be placed in specified output dir.

```
i=1
i=2
...
i=1082
i=1083
...
```

## Command-line options
 
- `fgps -h/--help`    - Shows the help page.
- `fgps -v/--version` - Shows the CLI version.
- `fgps --output`     - Specify the output folder destination.
- `fgps --headful`    - Disable headless mode.
- `fgps init`         - Initialize user configuration.
- `fgps --group-ids`  - Indicates which groups ids that we want to scrape (seperated by commas).
