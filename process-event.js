const axios = require('axios');
const {
  GOOGLE_API_KEY,
  GOOGLE_SEARCH_ENGINE_ID,
  SLACK_TOKEN,
  BOT_TOKEN
} = process.env;
exports.handler = async (event) => {
  console.log(event);

  // Our SLACK_TOKEN is unique to our app, so we only want to process request coming from the approriate App.
  if (event.token != SLACK_TOKEN) return;
  let msg = event.event.text;
  let channel = event.event.channel;

  /**
   * see {@link https://developers.google.com/custom-search/v1/using_rest}
   *
   * We are removing the bot's user id and creating a query with the users input
   */
  let queryConstructor = msg.replace(
    /<\W([A-Z])\w+> /g,
    `https://www.googleapis.com/customsearch/v1?key=${GOOGLE_API_KEY}&cx=${GOOGLE_SEARCH_ENGINE_ID}&q=`
  );
  let searchGoogle = await axios.get(queryConstructor);

  /**
   * see {@link https://api.slack.com/methods/chat.postMessage}
   *
   * Lets let the User know were googling their inquiry
   */
  const lmgtfy = 'let me google that for you.';
  await axios.post(
    `https://slack.com/api/chat.postMessage?token=${BOT_TOKEN}&channel=${channel}&text=${lmgtfy}&as_user=true&pretty=1`
  );

  // If our search returns no results, lets let the user know that we couldn't find anything
  if (!searchGoogle.data.items) {
    const noResult = `Couldn't find anything related to your input`;
    await axios.post(
      `https://slack.com/api/chat.postMessage?token=${BOT_TOKEN}&channel=${channel}&text=${noResult}&as_user=true&pretty=1`
    );
    return;
  }

  // We have our results, now lets choose the top 3 we would like to send.
  // and conruct an array of obj with the information we want
  let size = 3;
  let searchResults = searchGoogle.data.items.slice(0, size).map((result) => {
    return {
      title: result.title,
      link: result.link
    };
  });
  console.log(searchResults);
  await sendResultsToSlack(searchResults, channel);
  console.log('Sent to slack');
  return;
};

// Time to construct our attachment array of obj to use with slacks chat.postMessage APIs
async function sendResultsToSlack(searchResults, channel) {
  let attachments = await Promise.all(
    searchResults.map(async (res) => {
      return {
        pretext: `${res.title}`,
        fallback: `${res.title}`,
        text: `${res.link}`
      };
    })
  );
  attachments = JSON.stringify(attachments);
  console.log(attachments);
  await axios.post(
    `https://slack.com/api/chat.postMessage?token=${BOT_TOKEN}&channel=${channel}&text=results&attachments=${attachments}&as_user=true&pretty=1`
  );
}
