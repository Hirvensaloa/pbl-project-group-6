import { useAudioRecorder } from 'react-audio-voice-recorder';
import axios from 'axios';
import styled from 'styled-components';
import { useEffect, useState } from 'react';
import { US, TW, IT } from 'country-flag-icons/react/3x2';
import './Mqtt5Connect';

const url = process.env.REACT_APP_API_URL;

// Send the blob to the server
const sendAudio = async (blob, sourceLanguage, targetLanguage) => {
  console.log(
    'Sending audio to server. Target language:',
    targetLanguage,
    'Source language:',
    sourceLanguage
  );
  axios
    .post(url, blob, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'X-Target-Language': targetLanguage ?? 'en-US',
        'X-Source-Language': sourceLanguage ?? 'zh-TW',
      },
    })
    .then((response) => {
      console.log(response.data);
    })
    .catch((error) => {
      console.log(error);
    });
};

const availableLanguages = {
  English: 'en-US',
  Chinese: 'zh-TW',
  Italian: 'it-IT',
};

export default function AudioRecord() {
  const { startRecording, stopRecording, recordingBlob, isRecording } =
    useAudioRecorder();

  const [sourceLanguage, setSourceLanguage] = useState(
    availableLanguages.Chinese
  );
  const [targetLanguage, setTargetLanguage] = useState(
    availableLanguages.English
  );

  const [readyToSend, setReadyToSend] = useState(false);

  useEffect(() => {
    if (!recordingBlob) return;

    // recordingBlob will be present at this point after 'stopRecording' has been called
    setReadyToSend(true);
  }, [recordingBlob]);

  useEffect(() => {
    if (readyToSend) {
      sendAudio(recordingBlob, sourceLanguage, targetLanguage);
      setReadyToSend(false);
    }

    if (sourceLanguage === targetLanguage) {
      if (sourceLanguage === availableLanguages.English) {
        setTargetLanguage(availableLanguages.Chinese);
      } else {
        setTargetLanguage(availableLanguages.English);
      }
    }
  }, [readyToSend, recordingBlob, sourceLanguage, targetLanguage]);

  return (
    <Column>
      <Wrapper>
        <StyledButton onClick={startRecording} disabled={isRecording}>
          Start Recording
        </StyledButton>
        <StyledButton onClick={stopRecording} disabled={!isRecording}>
          Stop Recording
        </StyledButton>
      </Wrapper>
      <LanguageSelectorDiv>
        <h3>Input language</h3>
        <CountryRow>
          <StyledCountryButton
            onClick={() => setSourceLanguage(availableLanguages.English)}
            disabled={sourceLanguage === availableLanguages.English}
          >
            <US width='100' height='100' />
          </StyledCountryButton>
          <StyledCountryButton
            onClick={() => setSourceLanguage(availableLanguages.Chinese)}
            disabled={sourceLanguage === availableLanguages.Chinese}
          >
            <TW width='100' height='100' />
          </StyledCountryButton>
          <StyledCountryButton
            onClick={() => setSourceLanguage(availableLanguages.Italian)}
            disabled={sourceLanguage === availableLanguages.Italian}
          >
            <IT width='100' height='100' />
          </StyledCountryButton>
        </CountryRow>
      </LanguageSelectorDiv>
      <LanguageSelectorDiv>
        <h3>Output language</h3>
        <CountryRow>
          <StyledCountryButton
            onClick={() => setTargetLanguage(availableLanguages.English)}
            disabled={targetLanguage === availableLanguages.English}
          >
            <US width='100' height='100' />
          </StyledCountryButton>
          <StyledCountryButton
            onClick={() => setTargetLanguage(availableLanguages.Chinese)}
            disabled={targetLanguage === availableLanguages.Chinese}
          >
            <TW width='100' height='100' />
          </StyledCountryButton>
          <StyledCountryButton
            onClick={() => setTargetLanguage(availableLanguages.Italian)}
            disabled={targetLanguage === availableLanguages.Italian}
          >
            <IT width='100' height='100' />
          </StyledCountryButton>
        </CountryRow>
      </LanguageSelectorDiv>
    </Column>
  );
}

const StyledButton = styled.button`
  background-color: ${(props) => (props.disabled ? 'grey' : 'green')};
  margin: 10px;
  border: 1px solid green;
  border-radius: 12px;
  color: white;
  padding: 15px 32px;
  text-align: center;
  text-decoration: none;
  display: inline-block;
  font-size: 16px;
`;

const StyledCountryButton = styled.button`
  border: none;
  box-shadow: 0px 8px 16px 0px rgba(0, 0, 0, 0.2);
  background-color: ${(props) => (props.disabled ? '#d3d3d3' : 'white')};
  outline: ${(props) => (!props.disabled ? 'none' : '1px solid green')};
  margin: 10px;
  border-radius: 24px;
  text-align: center;
  text-decoration: none;
  display: flex;
  align-items: center;
  padding: 5px;
`;

const CountryRow = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: center;
`;

const LanguageSelectorDiv = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: center;
  margin: 12px;
`;

const Column = styled.div`
  width: 100vw;
  height: 100vh;
  display: flex;
  flex-direction: column;
  justify-content: center;
`;

const Wrapper = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
`;
