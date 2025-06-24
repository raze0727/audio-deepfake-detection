const { default: chalk } = require('chalk');
const {
  mainPanel,
  datasetTypePanel,
  pause,
  trainModelPanel,
} = require('./module/cli');
const {
  convertAudiosToWAVs,
  convertWAVsToMFCCs,
  clearFolder,
} = require('./module');
const { loadDataset, trainModel, predictAudio } = require('./module/model');
const { glob } = require('glob');
const { default: inquirer } = require('inquirer');

async function main() {
  while (true) {
    console.clear();
    const mainPanelOption = await mainPanel();

    console.clear();

    switch (mainPanelOption) {
      case 'predict_audio':
        const audioFileName = await inquirer.prompt([
          {
            type: 'input',
            name: 'option',
            message: chalk.magenta('Insert audio file name:'),
          },
        ]);
        const { avgReal, avgFake } = await predictAudio(`validation/real/${audioFileName.option}`);

        console.log(
          chalk.magenta(
            `Final averaged prediction | Real: ${avgReal.toFixed(
              3
            )}, Fake: ${avgFake.toFixed(3)}`
          )
        );
        console.log(
          chalk.magenta(`Final Result: ${avgReal > avgFake ? 'REAL' : 'FAKE'}`)
        );

        await pause();
        await clearFolder('temp');
        break;
      case 'train_model':
        let overrideOption = await trainModelPanel();
        if (overrideOption === 'back') break;
        if (overrideOption) {
          await clearFolder('stats');
          await clearFolder('model');
        }
        while (true) {
          const realLeft = (await glob('data/real/*.json')).length;
          const fakeLeft = (await glob('data/fake/*.json')).length;

          if (realLeft === 0 && fakeLeft === 0) {
            console.log(chalk.magenta('Successful trained all datas.'));
            break;
          }

          const { x, yOneHot } = await loadDataset();
          await trainModel(x, yOneHot, overrideOption);
          overrideOption = 0;
        }
        await pause();
        break;

      case 'process_datasets':
        const datasetOption = await datasetTypePanel();
        if (datasetOption === 'back') break;
        if (!['real', 'fake'].includes(datasetOption)) break;

        await convertAudiosToWAVs();
        await convertWAVsToMFCCs(datasetOption);
        await clearFolder('temp');
        await clearFolder('data/raw');
        console.log(chalk.magenta('Cleared raw data and temp folder.'));
        await pause();
        break;

      case 'exit':
        console.log(chalk.magenta('Goodbye.'));
        process.exit(0);
    }
  }
}

main();
