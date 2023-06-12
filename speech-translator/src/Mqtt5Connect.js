/**
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0.
 */

import { mqtt5, auth, iot } from 'aws-iot-device-sdk-v2';
import { once } from 'events';
import { fromCognitoIdentityPool } from '@aws-sdk/credential-providers';
import { toUtf8 } from '@aws-sdk/util-utf8-browser';

const Settings = {
  AWS_REGION: process.env.REACT_APP_AWS_REGION,
  AWS_COGNITO_IDENTITY_POOL_ID:
    process.env.REACT_APP_AWS_COGNITO_IDENTITY_POOL_ID,
  AWS_IOT_ENDPOINT: process.env.REACT_APP_AWS_IOT_ENDPOINT,
};

function log(msg) {
  console.log(msg);
}

/**
 * AWSCognitoCredentialsProvider. The AWSCognitoCredentialsProvider implements AWS.CognitoIdentityCredentials.
 *
 */
class AWSCognitoCredentialsProvider extends auth.CredentialsProvider {
  constructor(options, expire_interval_in_ms) {
    super();
    this.options = options;

    setInterval(async () => {
      await this.refreshCredentials();
    }, expire_interval_in_ms ?? 3600 * 1000);
  }

  getCredentials() {
    return {
      aws_access_id: this.cachedCredentials?.accessKeyId ?? '',
      aws_secret_key: this.cachedCredentials?.secretAccessKey ?? '',
      aws_sts_token: this.cachedCredentials?.sessionToken,
      aws_region: this.options.Region,
    };
  }

  async refreshCredentials() {
    log('Fetching Cognito credentials');
    this.cachedCredentials = await fromCognitoIdentityPool({
      // Required. The unique identifier for the identity pool from which an identity should be
      // retrieved or generated.
      identityPoolId: this.options.IdentityPoolId,
      clientConfig: { region: this.options.Region },
    })();
  }
}

function createClient(provider) {
  let wsConfig = {
    credentialsProvider: provider,
    region: Settings.AWS_REGION,
  };

  let builder =
    iot.AwsIotMqtt5ClientConfigBuilder.newWebsocketMqttBuilderWithSigv4Auth(
      Settings.AWS_IOT_ENDPOINT,
      wsConfig
    );

  let client = new mqtt5.Mqtt5Client(builder.build());

  client.on('error', (error) => {
    log('Error event: ' + error.toString());
  });

  client.on('attemptingConnect', (eventData) => {
    log('Attempting Connect event');
  });

  client.on('connectionSuccess', (eventData) => {
    log('Connection Success event');
    log('Connack: ' + JSON.stringify(eventData.connack));
    log('Settings: ' + JSON.stringify(eventData.settings));
  });

  client.on('connectionFailure', (eventData) => {
    log('Connection failure event: ' + eventData.error.toString());
  });

  client.on('disconnection', (eventData) => {
    log('Disconnection event: ' + eventData.error.toString());
    if (eventData.disconnect !== undefined) {
      log('Disconnect packet: ' + JSON.stringify(eventData.disconnect));
    }
  });

  client.on('stopped', (eventData) => {
    log('Stopped event');
  });

  return client;
}

export async function connect(setLoading) {
  const attemptingConnect = once(client, 'attemptingConnect');
  const connectionSuccess = once(client, 'connectionSuccess');

  client.start();

  await attemptingConnect;
  await connectionSuccess;

  const suback = await client.subscribe({
    subscriptions: [{ qos: mqtt5.QoS.AtMostOnce, topicFilter: 'translate' }],
  });
  log('Suback result: ' + JSON.stringify(suback));

  client.on('messageReceived', async (eventData) => {
    log('Message Received event: ' + JSON.stringify(eventData.message));
    if (eventData.message.payload) {
      // Convert the string to JSON
      const eventDataJson = JSON.parse(toUtf8(eventData.message.payload));
      const url = eventDataJson.url;

      console.log('Fetching from url', url);

      setLoading(false);

      // Download mp3 file from url and play it
      const audio = new Audio(url);
      audio.play();
    }
  });
}

log('Provider setup...');
/** Set up the credentialsProvider */
const provider = new AWSCognitoCredentialsProvider({
  IdentityPoolId: Settings.AWS_COGNITO_IDENTITY_POOL_ID,
  Region: Settings.AWS_REGION,
});

log('Fetching credentials...');
/** Make sure the credential provider fetched before setup the connection */
await provider.refreshCredentials();

let client = createClient(provider);

log('Client created, attempting connection...');
