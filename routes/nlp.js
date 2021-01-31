const router = require("express").Router();
const language = require("@google-cloud/language");
const textToSpeech = require("@google-cloud/text-to-speech");
const vision = require("@google-cloud/vision");
const consola = require("consola");
const path = require("path");

router.post("/", async (req, res) => {
  const { body, file } = req;

  consola.info(body);

  try {
    const keyFilename = path.join(__dirname, "/../keyfile.json");
    const langClient = new language.LanguageServiceClient({ keyFilename });
    const text2SpeechClient = new textToSpeech.TextToSpeechClient({
      keyFilename,
    });
    const visionClient = new vision.ImageAnnotatorClient({ keyFilename });

    const document = {
      content: body.data,
      type: "PLAIN_TEXT",
    };

    const [classification] = await langClient.classifyText({ document });
    const [sentimentResult] = await langClient.analyzeSentiment({ document });

    const sentiment = sentimentResult.documentSentiment;
    const keyPhrases = [];

    consola.info(
      `[*] Document received: ${JSON.stringify(classification.categories)}`
    );

    classification.categories.forEach((category) => {
      keyPhrases.push(category.name);
    });

    const request = {
      input: { text: body.data },
      // Select the language and SSML voice gender (optional)
      voice: { languageCode: "en-US", ssmlGender: "NEUTRAL" },
      // select the type of audio encoding
      audioConfig: { audioEncoding: "MP3" },
    };

    const [audioResponse] = await text2SpeechClient.synthesizeSpeech(request);
    const audioContent = audioResponse.audioContent;

    const [visionResponse] = await visionClient.faceDetection(file.buffer);
    const {
      joyLikelihood,
      sorrowLikelihood,
      angerLikelihood,
      headwearLikelihood,
      surpriseLikelihood,
      blurredLikelihood,
    } = visionResponse.faceAnnotations[0];

    consola.info(`[*] FaceInfo received: ${JSON.stringify(faceInfo)}`);

    res
      .status(200)
      .json({
        keyPhrases,
        sentiment,
        audioContent,
        face: {
          joyLikelihood,
          sorrowLikelihood,
          angerLikelihood,
          headwearLikelihood,
          surpriseLikelihood,
          blurredLikelihood,
        },
      });
  } catch (error) {
    consola.error(error);
    res.status(500).send("internal error occured");
  }
});

module.exports = router;
