const { writeFileSync, statSync, unlinkSync } = require('fs');
const { SingleBar, Presets } = require('cli-progress');
const { default: chalk } = require('chalk');
const { glob } = require('glob');

const { convertToMFCC, processRawAudio, processMFCC } = require('./audio');
const { sleep } = require('./misc');
const config = require('../config');

async function convertAudiosToWAVs() {
  const filePaths = await glob('data/raw/**');
  const audioFilePaths = filePaths.filter((file) =>
    config.audio.supportedExtensions.some((extension) =>
      file.endsWith(extension)
    )
  );

  const progressBar = new SingleBar(
    {
      format: chalk.magenta(
        `Converting datas to WAVs [{bar}] {percentage}% | ETA: {eta}s | {value}/{total} Files`
      ),
    },
    Presets.rect
  );
  let progress = 0;
  progressBar.start(audioFilePaths.length, 0);

  for (const filePath of audioFilePaths) {
    await processRawAudio(
      filePath,
      filePath.replaceAll('/', '-'),
      config.audio.audioChunkDuration
    );
    progress++;
    progressBar.update(progress);

    await sleep(10);
  }
  progressBar.stop();
  console.log(chalk.magenta('Successful converted all datas to WAVs.'));
}

async function convertWAVsToMFCCs(dataOption) {
  const audioFilePaths = await glob('temp/*.wav');

  const progressBar = new SingleBar(
    {
      format: chalk.magenta(
        `Converting WAVs to MFCCs [{bar}] {percentage}% | ETA: {eta}s | {value}/{total} Files`
      ),
    },
    Presets.rect
  );
  let progress = 0;
  progressBar.start(audioFilePaths.length, 0);

  for (const filePath of audioFilePaths) {
    const MFCC = await convertToMFCC(filePath);
    const processedMFCC = await processMFCC(MFCC);

    writeFileSync(
      `${config.audio.outputFolder}/${dataOption}/${filePath.replace(
        'temp/',
        ''
      )}.json`,
      JSON.stringify(processedMFCC, null, 2)
    );
    progress++;
    progressBar.update(progress);
  }
  progressBar.stop();
  console.log(chalk.magenta('Successful converted all WAVs to MFCCs.'));
}

async function clearFolder(folder) {
  const files = await glob(`${folder}/**`);
  files.forEach((file) => {
    const stat = statSync(file);
    if (stat.isFile()) unlinkSync(file);
  });
}
module.exports = { convertAudiosToWAVs, convertWAVsToMFCCs, clearFolder };
