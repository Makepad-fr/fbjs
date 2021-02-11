import minimist from 'minimist';

const authorizedArguments = ['version', 'init', 'help'];

const argParserParams: minimist.Opts = {
  string: ['group-ids', 'output'],
  boolean: ['version', 'help', 'debug', 'headful'],
  unknown: (arg) => authorizedArguments.includes(arg),
  default: { output: './' },
  alias: { h: 'help', v: 'version' },
  stopEarly: true, /* populate _ with first non-option */
};

export default minimist(
  process.argv.slice(2),
  argParserParams,
);
