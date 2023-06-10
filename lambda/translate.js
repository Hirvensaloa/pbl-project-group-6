import consumers from 'node:stream/consumers';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
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
  StartSpeechSynthesisTaskCommand,
  DescribeVoicesCommand,
} from '@aws-sdk/client-polly';

const config = {
  REGION: process.env.AWS_REGION,
  BUCKET_NAME: process.env.BUCKET_NAME,
  MEDIA_FORMAT: process.env.MEDIA_FORMAT,
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

  const command = new StartSpeechSynthesisTaskCommand(input);
  const response = await client.send(command);
  console.log('response', response);
};
