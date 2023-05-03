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
  REGION: 'ap-northeast-1',
  BUCKET_NAME: 'voice-app-bucket',
  MEDIA_FORMAT: 'mp3',
};

// Deployed from GitHub Action

export const handler = async (event) => {
  console.log(event);
  const jobName = event.detail.TranscriptionJobName;

  const res = await getTranscriptionJob(jobName);
  const uri = res.TranscriptionJob.Transcript.TranscriptFileUri;

  console.log('Downloading from uri', uri, res);
  const { transcript, languageCode } = await downloadTranscript(uri);
  console.log('transcript', transcript);

  const translatedText = await translate(transcript, languageCode, 'zh-TW');

  console.log('Translation', translatedText);

  // TODO: Take the language code from the event
  await synthesizeSpeech('cmn-CN', translatedText);

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
  const languageCode = results.language_code;

  return { transcript, languageCode };
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

const synthesizeSpeech = async (languageCode, text) => {
  const client = new PollyClient({ region: config.REGION });

  const { Voices } = await client.send(
    new DescribeVoicesCommand({ LanguageCode: languageCode })
  );
  const voiceId = Voices[0].Id;

  const timestamp = Date.now();
  const filename = `translation-${timestamp}.mp3`;
  const input = {
    // StartSpeechSynthesisTaskInput
    Engine: 'standard',
    LanguageCode: languageCode,
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
