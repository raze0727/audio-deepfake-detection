module.exports = {
  audio: {
    tempFolder: 'temp',
    outputFolder: 'data',
    audioFrameSize: 512,
    audioSampleRate: 44100,
    audioChunkDuration: 5,
    maxLen: 5000,
    supportedExtensions: ['.flac', '.mp3', '.m4a', '.ogg', '.wav'],
  },
  model: {
    saveFolder: 'file://model',
    epochs: 50,
    batchSize: 64,
    validationSplit: 0.2,
    learningRate: 1e-3,
  },
  normalization: {
    saveFolder: 'stats',
    epsilon: 1e-8,
  },
};
