const http = require("https");
const crypto = require("crypto");

const express = require("express");
const app = express();
const hubspot = require("@hubspot/api-client");
const {
  BedrockAgentRuntimeClient,
  InvokeAgentCommand,
} = require("@aws-sdk/client-bedrock-agent-runtime");

const bodyParser = require("body-parser");

const PORT = 3000;
// const CLIENT_ID = process.env.HUBSPOT_CLIENT_ID;
// const CLIENT_SECRET = process.env.HUBSPOT_CLIENT_SECRET;
// const APPLICATION_ID = process.env.HUBSPOT_APPLICATION_ID;
const DEVELOPER_API_KEY = process.env.HUBSPOT_DEVELOPER_API_KEY;
const HUBSPOT_ACCESS_TOKEN = process.env.HUBSPOT_ACCESS_TOKEN;

const BEDROCK_ACCESS_KEY = process.env.BEDROCK_ACCESS_KEY;
const BEDROCK_SECRET_ACCESS_KEY = process.env.BEDROCK_SECRET_ACCESS_KEY;
const BEDROCK_AGENT_ID = process.env.BEDROCK_AGENT_ID;
const BEDROCK_AGENT_ALIAS_ID = process.env.BEDROCK_AGENT_ALIAS_ID;

app.use(bodyParser.urlencoded({ limit: "20mb", extended: false }));
app.use(bodyParser.json({ limit: "20mb" }));

const bedrockClient = new BedrockAgentRuntimeClient({
  region: "us-west-2",
  credentials: {
    accessKeyId: BEDROCK_ACCESS_KEY,
    secretAccessKey: BEDROCK_SECRET_ACCESS_KEY,
  },
});

const hubspotClient = new hubspot.Client({
  developerApiKey: DEVELOPER_API_KEY,
});

app.get("/", (req, res) => {
  res.send("Hello World");
});

app.post("/", async (req, res) => {
  const events = req.body;

  const { actorID, threadID, channelID, message } = events;

  const command = new InvokeAgentCommand({
    agentId: BEDROCK_AGENT_ID,
    agentAliasId: BEDROCK_AGENT_ALIAS_ID,
    sessionId: channelID,
    inputText: message,
  });

  try {
    let completion = "";
    const response = await bedrockClient.send(command);

    if (response.completion === undefined) {
      throw new Error("Completion is undefined");
    }

    for await (let chunkEvent of response.completion) {
      const chunk = chunkEvent.chunk;
      const decodedResponse = new TextDecoder("utf-8").decode(chunk.bytes);
      completion += decodedResponse;
    }

    const options = {
      method: "POST",
      hostname: "api.hubspot.com",
      port: null,
      path: `conversations/v3/conversations/threads/${threadID}/messages`,
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        authorization: `Bearer ${HUBSPOT_ACCESS_TOKEN}`,
      },
    };

    const hubspotReq = http
      .request(options)
      .write(JSON.stringify({ type: "MESSAGE", text: completion }));
  } catch (error) {
    console.error(error);
  }
});

app.listen(PORT, () => {
  console.log(`App listening on port ${PORT}`);
});
