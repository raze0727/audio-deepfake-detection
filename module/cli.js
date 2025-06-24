const { default: chalk } = require('chalk');
const { default: inquirer } = require('inquirer');

async function mainPanel() {
  const { option } = await inquirer.prompt([
    {
      type: 'list',
      name: 'option',
      message: 'Select an option:',
      choices: [
        { name: chalk.magenta('Predict audio'), value: 'predict_audio' },
        { name: chalk.magenta('Train model'), value: 'train_model' },
        {
          name: chalk.magenta('Convert audios to datasets'),
          value: 'process_datasets',
        },
        { name: chalk.magenta('Exit'), value: 'exit' },
      ],
    },
  ]);
  return option;
}

async function trainModelPanel() {
  const { option } = await inquirer.prompt({
    type: 'list',
    name: 'option',
    message: 'Override current mean & std?',
    choices: [
      { name: chalk.magenta('No'), value: 0 },
      {
        name: chalk.magenta('Yes'),
        value: 1,
      },
      { name: chalk.magenta('Back'), value: 'back' },
    ],
  });

  return option;
}
async function datasetTypePanel() {
  const { option } = await inquirer.prompt({
    type: 'list',
    name: 'option',
    message: 'Select an option:',
    choices: [
      { name: chalk.magenta('Real Audio Datasets'), value: 'real' },
      {
        name: chalk.magenta('Fake Audio Datasets'),
        value: 'fake',
      },
      { name: chalk.magenta('Back'), value: 'back' },
    ],
  });

  return option;
}
async function pause() {
  await inquirer.prompt([
    {
      type: 'input',
      name: 'continue',
      message: chalk.gray('Press Enter to continue...'),
    },
  ]);
}

module.exports = { mainPanel, trainModelPanel, datasetTypePanel, pause };
