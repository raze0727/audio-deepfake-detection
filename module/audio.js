const config = require('../config').audio;
const { exec } = require('child_process');
const { readFileSync } = require('fs');
const meyda = require('meyda');
const { decode } = require('wav-decoder');
const util = require('util');
const execPromise = util.promisify(exec);

async function processRawAudio(
  audioFilePath,
  outputFileName,
  audioChunkDuration
) {
  const cmd = `ffmpeg -y -i "${audioFilePath}" -ac 1 -ar ${config.audioSampleRate} -f segment -segment_time ${audioChunkDuration} -c:a pcm_s16le "${config.tempFolder}/${outputFileName}_%03d.wav"`;

  try {
    await execPromise(cmd);
  } catch (e) {}
}

async function processMFCC(rawData) {
  const flattenedData = rawData.flat();
  const paddedData = new Array(config.maxLen)
    .fill(0)
    .map((_, i) => flattenedData[i] || 0);
  return paddedData;
}

async function convertToMFCC(audioFilePath) {
  const buffer = readFileSync(audioFilePath);
  const audioData = await decode(buffer);
  if (audioData.length < 3) return;
  const signal = audioData.channelData[0];

  const mfccFrames = [];
  for (
    let i = 0;
    i < signal.length - config.audioFrameSize;
    i += config.audioFrameSize
  ) {
    const frame = signal.slice(i, i + config.audioFrameSize);
    const mfccFrame = meyda.extract('mfcc', frame, {
      bufferSize: config.audioFrameSize,
      sampleRate: config.audioSampleRate,
      numberOfMFCCCoefficients: 40,
    });

    if (mfccFrame) mfccFrames.push(mfccFrame);
  }
  return mfccFrames;
}

module.exports = {
  processRawAudio,
  processMFCC,
  convertToMFCC,
};
