import {
  IoTDataPlaneClient,
  PublishCommand,
} from '@aws-sdk/client-iot-data-plane';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const config = {
  BUCKET_NAME: process.env.BUCKET_NAME,
};

export const handler = async (event) => {
  console.log(event);
  const filename = event.Records[0].s3.object.key;
  const signedUrl = await getPresignUrl(filename);
  console.log('filename', filename);

  const client = new IoTDataPlaneClient();

  const message = {
    url: signedUrl,
  };

  const input = {
    topic: 'translate', // required,
    contentType: 'application/json',
    payload: JSON.stringify(message),
  };
  console.log('input', input);
  const command = new PublishCommand(input);
  await client.send(command);
  // TODO implement
  const response = {
    statusCode: 200,
    body: JSON.stringify('Hello from Lambda!'),
  };
  return response;
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
