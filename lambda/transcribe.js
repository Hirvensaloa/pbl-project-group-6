import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import {
  StartTranscriptionJobCommand,
  TranscribeClient,
} from '@aws-sdk/client-transcribe';

const config = {
  REGION: process.env.AWS_REGION,
  BUCKET_NAME: process.env.BUCKET_NAME,
};

export const handler = async (event) => {
  console.log(event);

  // Extract the encoded binary file from the body
  const encoded = event.body;
  // Decode base64 string to binary
  const decoded = Buffer.from(encoded, 'base64');

  // Extract X-Source-Language header which contains the source language
  const sourceLanguage = event.headers['x-source-language'];
  // Extract X-Target-Language header which contains the target language
  const targetLanguage = event.headers['x-target-language'];

  try {
    // Create file title with timestamp
    const timestamp = Date.now();
    const filename = `speech-${timestamp}.${sourceLanguage}.${targetLanguage}.ogx`;

    // Upload mp3 file to S3
    await uploadAudio(filename, config.BUCKET_NAME, decoded);

    // Start the transcribtion job
    await startTranscribeJob(filename, sourceLanguage);

    const response = {
      statusCode: 200,
      body: JSON.stringify('Started transcribing!'),
    };

    return response;
  } catch (err) {
    console.log(err);
    const response = {
      statusCode: 500,
      body: err,
    };

    return response;
  }
};

// Upload audio file to the bucket. Returns nothing if successful, throws error otherwise.
const uploadAudio = async (filename, bucketname, file) => {
  const client = new S3Client();

  const input = {
    Key: filename,
    Body: file,
    Bucket: bucketname,
    ContentType: 'audio/mpeg',
  };

  const command = new PutObjectCommand(input);
  const response = await client.send(command);
  console.log(response);

  if (response['$metadata'].httpStatusCode !== 200) {
    throw new Error('Error uploading file to S3');
  }
};

// Start transcribe job for a specific audio file in s3 bucket
const startTranscribeJob = async (filename, languageCode) => {
  // Create an Amazon Transcribe service client object.
  const transcribeClient = new TranscribeClient({ region: config.REGION });
  const fileUri = `https://${config.BUCKET_NAME}.s3-${config.REGION}.amazonaws.com/${filename}`;
  const jobName = `audio-transcription-job-${filename}`;

  const params = {
    TranscriptionJobName: jobName,
    MediaFormat: 'ogg',
    Media: {
      MediaFileUri: fileUri,
    },
    OutputBucketName: config.BUCKET_NAME,
    LanguageCode: languageCode,
  };

  await transcribeClient.send(new StartTranscriptionJobCommand(params));
};
