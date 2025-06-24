const { readFileSync, writeFileSync, renameSync } = require('fs');
const tf = require('@tensorflow/tfjs-node');
const { SingleBar, Presets } = require('cli-progress');
const { default: chalk } = require('chalk');
const { glob } = require('glob');
const config = require('../config');
const { processRawAudio, processMFCC, convertToMFCC } = require('./audio');
const { basename } = require('path');

async function loadDataset() {
  const dataFolder = ['real', 'fake'];
  const dataSets = [];
  const dataLabels = [];

  for (let labelIndex = 0; labelIndex < dataFolder.length; labelIndex++) {
    const folderName = dataFolder[labelIndex];
    const files = await glob(`data/${folderName}/*.json`);

    const progressBar = new SingleBar(
      {
        format: chalk.magenta(
          `Loading ${folderName} datasets [{bar}] {percentage}% | ETA: {eta}s | {value}/{total} Files`
        ),
      },
      Presets.rect
    );
    let progress = 0;
    let count = 0;
    progressBar.start(Math.min(10000, files.length), 0);

    for (const file of files) {
      if (count >= 10000) break;
      const data = JSON.parse(readFileSync(file));
      if (data.length !== 5000) return console.log(`Skipped ${data}`);
      dataSets.push(data);
      dataLabels.push(labelIndex);
      renameSync(
        file,
        `${config.audio.outputFolder}/trained/${folderName}/${basename(file)}`
      );
      progress++;
      count++;
      progressBar.update(progress);
    }
    progressBar.stop();
    console.log(chalk.magenta(`Finished loading all ${folderName} datasets.`));
  }

  const paired = dataSets.map((data, i) => ({ data, label: dataLabels[i] }));

  for (let i = paired.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [paired[i], paired[j]] = [paired[j], paired[i]];
  }

  const shuffledData = paired.map((p) => p.data);
  const shuffledLabels = paired.map((p) => p.label);

  const x = tf.tensor2d(shuffledData);
  const y = tf.tensor1d(shuffledLabels, 'int32');
  const yOneHot = tf.oneHot(y, 2);
  y.dispose();

  return { x, yOneHot };
}

async function trainModel(x, yOneHot, override) {
  let model;
  if (override) {
    model = tf.sequential();
    model.add(
      tf.layers.dense({
        inputShape: [config.audio.maxLen],
        units: 512,
        activation: 'relu',
        kernelRegularizer: tf.regularizers.l2({ l2: 0.001 }), // Optional L2
      })
    );
    model.add(tf.layers.batchNormalization()); // Optional normalization
    model.add(tf.layers.dropout({ rate: 0.3 }));

    model.add(tf.layers.dense({ units: 256, activation: 'relu' }));
    model.add(tf.layers.batchNormalization());
    model.add(tf.layers.dropout({ rate: 0.3 }));

    model.add(tf.layers.dense({ units: 64, activation: 'relu' }));
    model.add(tf.layers.dense({ units: 2, activation: 'softmax' }));
  } else model = await tf.loadLayersModel('file://model/model.json');

  model.compile({
    optimizer: tf.train.adam(config.model.learningRate),
    loss: 'categoricalCrossentropy',
    metrics: ['accuracy'],
  });

  let meanArray;
  let stdArray;
  if (override) {
    const { mean, variance } = tf.moments(x, 0);
    let std = tf.sqrt(variance).add(tf.scalar(config.normalization.epsilon));
    meanArray = await mean.array();
    stdArray = await std.array();

    writeFileSync(
      `${config.normalization.saveFolder}/mean.json`,
      JSON.stringify(meanArray)
    );
    writeFileSync(
      `${config.normalization.saveFolder}/std.json`,
      JSON.stringify(stdArray)
    );
  } else {
    meanArray = JSON.parse(
      readFileSync(`${config.normalization.saveFolder}/mean.json`)
    );
    stdArray = JSON.parse(
      readFileSync(`${config.normalization.saveFolder}/std.json`)
    );
  }
  const mean = tf.tensor1d(meanArray);
  const std = tf.tensor1d(stdArray);
  const xNorm = x.sub(mean).div(std);

  console.log('Normalization stats:');
  mean.print();
  std.print();
  xNorm.isNaN().any().print();

  await model.fit(xNorm, yOneHot, {
    epochs: config.model.epochs,
    batchSize: config.model.batchSize,
    validationSplit: config.model.validationSplit,
    shuffle: true,
    verbose: 1,
  });

  await model.save(config.model.saveFolder);
  console.log(chalk.magenta('Model training complete and saved.'));

  const [finalLoss, finalAcc] = await model.evaluate(xNorm, yOneHot);
  const loss = (await finalLoss.data())[0];
  const acc = (await finalAcc.data())[0];
  console.log(
    `Final Evaluation:\nLoss: ${loss.toFixed(4)}\nAccuracy: ${(
      acc * 100
    ).toFixed(2)}%`
  );
  tf.dispose([xNorm, mean, std, yOneHot]);
}

async function predictAudio(audioPath) {
  await processRawAudio(
    audioPath,
    audioPath.replaceAll('/', '-'),
    config.audio.audioChunkDuration
  );

  const meanArray = JSON.parse(
    readFileSync(`${config.normalization.saveFolder}/mean.json`)
  );
  const stdArray = JSON.parse(
    readFileSync(`${config.normalization.saveFolder}/std.json`)
  );
  const mean = tf.tensor1d(meanArray);
  const std = tf.tensor1d(stdArray);

  const model = await tf.loadLayersModel(
    `${config.model.saveFolder}/model.json`
  );

  let total = [0, 0];
  const audioFilePaths = await glob('temp/*.wav');
  for (const filePath of audioFilePaths) {
    const MFCC = await convertToMFCC(filePath);
    const processedMFCC = await processMFCC(MFCC);

    const input = tf.tensor2d([processedMFCC]).sub(mean).div(std);
    const output = model.predict(input);
    const prediction = output.dataSync();

    total[0] += prediction[0]; // real
    total[1] += prediction[1]; // fake

    tf.dispose([input, output]);
  }

  const avgReal = total[0] / audioFilePaths.length;
  const avgFake = total[1] / audioFilePaths.length;

  return { avgReal, avgFake };
}

module.exports = { loadDataset, trainModel, predictAudio };
