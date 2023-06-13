import { useAudioRecorder } from 'react-audio-voice-recorder';
import axios from 'axios';
import styled from 'styled-components';
import { useEffect, useState } from 'react';
import { US, TW, IT } from 'country-flag-icons/react/3x2';
import { HiSwitchVertical } from 'react-icons/hi';

import { connect } from './Mqtt5Connect';

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
  Detect: 'auto', // Indicates that language will be detected automatically
};

export default function AudioRecord() {
  const { startRecording, stopRecording, recordingBlob, isRecording } =
    useAudioRecorder();

  const [language, setLanguage] = useState({
    source: availableLanguages.English,
    target: availableLanguages.Chinese,
  });

  const [readyToSend, setReadyToSend] = useState(false);
  const [translating, setTranslating] = useState(false);

  useEffect(() => {
    if (!recordingBlob) return;

    // recordingBlob will be present at this point after 'stopRecording' has been called
    setReadyToSend(true);
  }, [recordingBlob]);

  useEffect(() => {
    if (readyToSend) {
      sendAudio(recordingBlob, language.source, language.target);
      setReadyToSend(false);
      setTranslating(true);
    }

    if (language.source === language.target) {
      if (language.target !== availableLanguages.English) {
        setLanguage({
          ...language,
          target: availableLanguages.English,
        });
      } else {
        setLanguage({
          ...language,
          target: availableLanguages.Chinese,
        });
      }
    }
  }, [readyToSend, recordingBlob, language]);

  const switchLanguages = () => {
    const source = language.target;
    const target = language.source;

    setLanguage({ source, target });
  };

  useEffect(() => {
    connect(setTranslating);
  }, []);

  return (
    <Column>
      <Wrapper>
        <StyledButton
          onClick={startRecording}
          disabled={isRecording || translating}
        >
          {translating
            ? 'Translating...'
            : isRecording
            ? 'Recording...'
            : 'Start Recording'}
        </StyledButton>
        <StyledButton onClick={stopRecording} disabled={!isRecording}>
          Stop Recording
        </StyledButton>
      </Wrapper>

      <LanguageSelectorDiv>
        <h3>Input language</h3>
        <CountryRow>
          <StyledCountryButton
            onClick={() => {
              setLanguage({ ...language, source: availableLanguages.Detect });
            }}
            disabled={language.source === availableLanguages.Detect}
          >
            <h3>Detect language</h3>
          </StyledCountryButton>
          <StyledCountryButton
            onClick={() =>
              setLanguage({
                ...language,
                source: availableLanguages.English,
              })
            }
            disabled={language.source === availableLanguages.English}
          >
            <US width='100' height='100' />
          </StyledCountryButton>
          <StyledCountryButton
            onClick={() =>
              setLanguage({
                ...language,
                source: availableLanguages.Chinese,
              })
            }
            disabled={language.source === availableLanguages.Chinese}
          >
            <TW width='100' height='100' />
          </StyledCountryButton>
          <StyledCountryButton
            onClick={() =>
              setLanguage({
                ...language,
                source: availableLanguages.Italian,
              })
            }
            disabled={language.source === availableLanguages.Italian}
          >
            <IT width='100' height='100' />
          </StyledCountryButton>
        </CountryRow>
      </LanguageSelectorDiv>

      <LanguageSwitchButton
        onClick={switchLanguages}
        disabled={language.source === availableLanguages.Detect}
      >
        <HiSwitchVertical size={'20px'} />
      </LanguageSwitchButton>

      <LanguageSelectorDiv>
        <h3>Output language</h3>
        <CountryRow>
          <StyledCountryButton
            onClick={() =>
              setLanguage({ ...language, target: availableLanguages.English })
            }
            disabled={language.target === availableLanguages.English}
          >
            <US width='100' height='100' />
          </StyledCountryButton>
          <StyledCountryButton
            onClick={() =>
              setLanguage({ ...language, target: availableLanguages.Chinese })
            }
            disabled={language.target === availableLanguages.Chinese}
          >
            <TW width='100' height='100' />
          </StyledCountryButton>
          <StyledCountryButton
            onClick={() =>
              setLanguage({ ...language, target: availableLanguages.Italian })
            }
            disabled={language.target === availableLanguages.Italian}
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
  display: inline-block;
  font-size: 16px;
`;

const StyledCountryButton = styled.button`
  border: none;
  box-shadow: 0px 8px 16px 0px rgba(0, 0, 0, 0.2);
  background-color: ${(props) => (props.disabled ? '#d3d3d3' : 'white')};
  outline: ${(props) => (!props.disabled ? 'none' : '3px solid green')};
  margin: 10px;
  border-radius: 24px;
  text-align: center;
  display: flex;
  align-items: center;
  padding: 5px;
  height: 100px;
  width: 100px;
`;

const LanguageSwitchButton = styled.button`
  border: 1px solid black;
  border-radius: 100%;
  width: 50px;
  height: 50px;
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
  align-items: center;
`;

const Wrapper = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
`;
