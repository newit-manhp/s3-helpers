'use strict';
const { argv } = require('yargs');
const yargs = require('yargs');
const zipStream = require('./zip/zip-stream');

const args = yargs(process.argv.slice(2))
  .usage('Usage: $0 -i [input bucket] -in [input path] -on [output name]')
  .command(
    'zip',
    'zip s3 bucket',
    (yargs) => {
      return yargs
        .option('b', {
          alias: 'bucket',
          type: 'string',
          required: true,
        })
        .option('i', {
          alias: 'in',
          type: 'string',
        })
        .option('o', {
          alias: 'out',
          type: 'string',
        });
    },
    async (args) => {
      try {
        // do list
        await zipStream(args.b, args.in, args.out);
      } catch (err) {
        console.error(err);
      }
    }
  ).argv;
