'use strict';
const archiver = require('archiver');
const { PassThrough } = require('stream');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { GetObjectCommand, ListObjectsCommand } = require('@aws-sdk/client-s3');

/**
 *
 * @param {S3Client} client
 * @param {string} bucket
 * @param {String} inputPath
 * @return {Promise.<String[]>}
 */
const listObject = async (client, bucket, inputPath) => {
  const res = await client.send(
    new ListObjectsCommand({
      Bucket: bucket,
      Prefix: inputPath,
    })
  );
  if (!res.Contents) {
    throw new Error('Not found');
  }
  return res.Contents.map(({ Key }) => Key);
};

/**
 *
 * @param {S3Client} client
 * @param {string} bucket
 * @param {String} inputPath
 * @return {Promise.<Readable | ReadableStream | Blob>}
 */
const downloadObject = async (client, bucket, inputPath) => {
  const res = await client.send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: inputPath,
    })
  );
  return res.Body;
};

/**
 *
 * @param {S3Client} client
 * @param {string} bucket
 * @param {String} inputPath
 * @param {Readable} stream
 */
const uploadObject = async (client, bucket, outputPath, stream) => {
  const res = await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: outputPath,
      Body: stream,
    })
  );
};

// setInterval(() => {
//   console.log('mem', process.memoryUsage().heapUsed / 1024 / 1024);
// }, 2000);
/**
 *
 * @param {string} bucket
 * @param {string} inputPath
 * @param {string} outputPath
 */
const zipStream = async (bucket, inputPath, outputPath) => {
  const s3Client = new S3Client({
    endpoint: process.env.AWS_S3_ENDPOINT,
    region: process.env.AWS_REGION,
    forcePathStyle: !!process.env.AWS_S3_ENDPOINT,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_ACCESS_KEY,
    },
  });
  const files = await listObject(s3Client, bucket, inputPath);
  const getFileName = (str) => str.substr(str.lastIndexOf('/') + 1);
  const outStream = archiver('zip', {
    statConcurrency: 8,
    store: true,
    // zlib: {
    //   chunkSize: 200 * 1024 * 1024,
    //   level: 0,
    // },
  });
  outStream.on('error', (err) => {
    throw err;
  });
  outStream.on('progress', (processData) => {
    console.log(`processing: ${processData.entries.processed}/${files.length}`);
  });
  outStream.on('warning', (w) => {
    console.warn(w);
  });
  outStream.on('close', () => {
    console.log(`${outStream.pointer()} total bytes`);
  });
  outStream.on('entry', (entry) => {
    console.log('Working on entry: ', entry.name);
  });
  // outStream.pipe(require('fs').createWriteStream('./test.zip'));
  const passThrough = new PassThrough();
  outStream.pipe(passThrough);
  const uploadTask = uploadObject(
    s3Client,
    bucket,
    outputPath,
    passThrough
  );

  // await Promise.all(
  //   files.map(async (file) => {
  //     (await downloadObject(s3Client, bucket, file)).pipe(require('fs').createWriteStream(file))
  //   })
  // );

  await Promise.all(
    files.map(async (file) =>
      outStream.append(await downloadObject(s3Client, bucket, file), {
        name: getFileName(file),
      })
    )
  );
  await outStream.finalize();
  await uploadTask;
};

module.exports = zipStream;
