const router = require("express").Router();
const language = require("@google-cloud/language");
const textToSpeech = require("@google-cloud/text-to-speech");
const vision = require("@google-cloud/vision");
const consola = require("consola");
const path = require("path");

const products = require("../productMap");

const Likelihood = {
  UNKNOWN: 0,
  VERY_UNLIKELY: 1,
  UNLIKELY: 2,
  POSSIBLE: 3,
  LIKELY: 4,
  VERY_LIKELY: 5,
};

router.post("/", async (req, res) => {
  const { body, file } = req;

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

    const [sentimentResult] = await langClient.analyzeSentiment({ document });
    const sentiment = sentimentResult.documentSentiment;
    consola.info(`Sentiment analysis received`);

    const [classification] = await langClient.classifyText({ document });
    const keyPhrases = [];
    classification.categories.forEach((category) => {
      const items = category.name.split("/").filter((e) => e !== "");
      keyPhrases.push(...items);
    });
    consola.info(`Categories document received`);

    const request = {
      input: { text: body.data },
      // Select the language and SSML voice gender (optional)
      voice: { languageCode: "en-US", ssmlGender: "NEUTRAL" },
      // select the type of audio encoding
      audioConfig: { audioEncoding: "MP3" },
    };
    const [audioResponse] = await text2SpeechClient.synthesizeSpeech(request);
    const audioContent = audioResponse.audioContent;
    consola.info(`Audio document received`);

    const tags = [];
    const recommendedProducts = [];
    let mood = {};

    if (file) {
      const [visionResponse] = await visionClient.faceDetection(file.buffer);
      const {
        joyLikelihood,
        sorrowLikelihood,
        angerLikelihood,
        headwearLikelihood,
        surpriseLikelihood,
        blurredLikelihood,
      } = visionResponse.faceAnnotations[0];
      consola.info(`FaceInfo received`);

      mood = {
        joyLikelihood,
        sorrowLikelihood,
        angerLikelihood,
        headwearLikelihood,
        surpriseLikelihood,
        blurredLikelihood,
      };

      const face = {
        joyLikelihood: Likelihood[joyLikelihood],
        sorrowLikelihood: Likelihood[sorrowLikelihood],
        angerLikelihood: Likelihood[angerLikelihood],
        headwearLikelihood: Likelihood[headwearLikelihood],
        surpriseLikelihood: Likelihood[surpriseLikelihood],
        blurredLikelihood: Likelihood[blurredLikelihood],
      };

      for (const emo of Object.keys(face)) {
        if (face[emo] >= 3) {
          tags.push(emo);
        }
      }
    } else {
      if (sentiment.score <= -0.25) {
        // NEGATIVE
        tags.push("sorrowLikelihood", "angerLikelihood");
      } else if (sentiment.score <= 0.25) {
        // NEUTRAL
        tags.push("headwearLikelihood", "blurredLikelihood");
      } else {
        // POSITIVE
        tags.push("joyLikelihood", "surpriseLikelihood");
      }
    }

    for (const product of products) {
      for (const tag of tags) {
        if (product.tags.includes(tag)) {
          recommendedProducts.push(product);
        }
      }
    }

    res.status(200).json({
      keyPhrases,
      sentiment,
      audioContent,
      tags,
      recommendedProducts,
      mood,
    });
  } catch (error) {
    consola.error(error);
    res.status(500).send("internal error occured");
  }
});

module.exports = router;
