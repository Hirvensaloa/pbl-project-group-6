import consumers from 'node:stream/consumers';
import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import {
  GetTranscriptionJobCommand,
  TranscribeClient,
} from '@aws-sdk/client-transcribe';
import {
  TranslateClient,
  TranslateTextCommand,
} from '@aws-sdk/client-translate';
import {
  PollyClient,
  SynthesizeSpeechCommand,
  DescribeVoicesCommand,
} from '@aws-sdk/client-polly';
import {
  IoTDataPlaneClient,
  PublishCommand,
} from '@aws-sdk/client-iot-data-plane';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// Set this in the Lambda environment variables
const config = {
  REGION: process.env.AWS_REGION,
  BUCKET_NAME: process.env.BUCKET_NAME,
  MEDIA_FORMAT: process.env.MEDIA_FORMAT,
  TOPIC: process.env.TOPIC,
};

export const handler = async (event) => {
  console.log(event);
  const jobName = event.detail.TranscriptionJobName;

  const res = await getTranscriptionJob(jobName);
  const uri = res.TranscriptionJob.Transcript.TranscriptFileUri;

  console.log('Downloading from uri', uri, res);
  const { transcript, sourceLanguage, targetLanguage } =
    await downloadTranscript(uri);
  console.log('transcript', transcript);

  const translatedText = await translate(
    transcript,
    sourceLanguage,
    targetLanguage
  );

  console.log('Translation', translatedText);

  await synthesizeSpeech(translatedText, targetLanguage);

  const response = {
    statusCode: 200,
  };
  return response;
};

// Download transcript from S3
const downloadTranscript = async (uri) => {
  const client = new S3Client({ region: config.REGION });

  // Get the file name from uri
  const filename = uri.split('/').pop();

  //Read the source language from the filename
  const sourceLanguage = filename.split('.')[1];
  // Read the target language from the filename
  const targetLanguage = filename.split('.')[2];

  const params = {
    Bucket: config.BUCKET_NAME,
    Key: filename,
  };

  const command = new GetObjectCommand(params);
  const response = await client.send(command);
  console.log(response);

  if (response['$metadata'].httpStatusCode !== 200) {
    throw new Error('Error downloading file from S3');
  }

  const { results } = await consumers.json(response.Body);

  const transcript = results.transcripts[0].transcript;

  return { transcript, sourceLanguage, targetLanguage };
};

const getTranscriptionJob = async (jobName) => {
  const transcribeClient = new TranscribeClient({ region: config.REGION });
  const input = {
    TranscriptionJobName: jobName,
  };

  const command = new GetTranscriptionJobCommand(input);
  return transcribeClient.send(command);
};

// Translates the text and returns the translation. Returns undefined if translation is empty or fails.
const translate = async (text, sourceLanguage, targetLanguage) => {
  const client = new TranslateClient(config);
  const input = {
    Text: text,
    SourceLanguageCode: sourceLanguage,
    TargetLanguageCode: targetLanguage,
    Settings: {
      Formality: 'FORMAL',
      Profanity: 'MASK',
    },
  };
  const command = new TranslateTextCommand(input);
  const response = await client.send(command);

  return response.TranslatedText;
};

const synthesizeSpeech = async (text, languageCode) => {
  const client = new PollyClient({ region: config.REGION });

  const { Voices } = await client.send(
    new DescribeVoicesCommand({ Engine: 'standard' })
  );

  // Taiwanese Mandarin is not supported by Polly. So use Mandarin instead.
  const matchingLanguageCode =
    languageCode === 'zh-TW' ? 'cmn-CN' : languageCode;

  const voice =
    Voices.find((voice) => voice.LanguageCode === matchingLanguageCode) ??
    Voices[0];
  const voiceId = voice.Id;

  const timestamp = Date.now();
  const filename = `translation-${timestamp}.mp3`;
  const input = {
    // StartSpeechSynthesisTaskInput
    Engine: 'standard',
    OutputFormat: config.MEDIA_FORMAT,
    OutputS3BucketName: config.BUCKET_NAME,
    OutputS3KeyPrefix: filename,
    Text: text,
    TextType: 'text',
    VoiceId: voiceId,
  };

  const command = new SynthesizeSpeechCommand(input);
  const response = await client.send(command);

  console.log('response', response);

  const iotClient = new IoTDataPlaneClient();

  const audioStream = response.AudioStream;
  // Convert the audio stream to mp3
  const audioBuffer = await consumers.arrayBuffer(audioStream);

  const outputFilename = `output-${timestamp}.mp3`;

  // Upload the bucket to s3, as mqtt supports only 128kB payload which is enough for short audio files but not longer ones.
  // Next improvement would be to implement Mqtt file transfer to avoid overhead of uploading to s3.
  await uploadToS3(outputFilename, audioBuffer);

  // Get a presigned url for the file and send it to the device using Mqtt
  const signedUrl = await getPresignUrl(outputFilename);

  const message = {
    url: signedUrl,
  };

  const iotInput = {
    topic: config.TOPIC, // required,
    contentType: 'application/json',
    payload: JSON.stringify(message),
  };
  console.log('iotInput', iotInput);

  const iotCommand = new PublishCommand(iotInput);
  await iotClient.send(iotCommand);
};

const uploadToS3 = async (filename, file) => {
  const client = new S3Client();

  const input = {
    Key: filename,
    Body: file,
    Bucket: config.BUCKET_NAME,
    ContentType: 'text/plain',
  };

  const command = new PutObjectCommand(input);
  const response = await client.send(command);
  console.log(response);

  if (response['$metadata'].httpStatusCode !== 200) {
    throw new Error('Error uploading file to S3');
  }
};

const getPresignUrl = async (filename) => {
  const client = new S3Client({ region: config.REGION });

  const params = {
    Bucket: config.BUCKET_NAME,
    Key: filename,
  };

  const command = new GetObjectCommand(params);
  const url = await getSignedUrl(client, command, { expiresIn: 3600 });
  return url;
};
