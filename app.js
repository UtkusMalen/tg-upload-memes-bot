const snoowrap = require('snoowrap');
const axios = require('axios');
const fs = require('fs');
const TelegramBot = require('node-telegram-bot-api');

botToken = '6915358362:AAGzZwbhFbifrHJsU4beGIny1Bt3hiXkRjY'
bot = new TelegramBot(botToken, {polling: true});
const chatId = '1092856248';

const reddit = new snoowrap({
    userAgent: 'MyBot/1.0.0 (by /u/UtkusMalen1)',
    clientId: '4s1VIHUXxBGKfGWDRfF8ew',
    clientSecret: 'NwFm-UQDAWn6GcjiYIx7Ii2rmVxaEQ',
    accessToken: 'bHmICde9894tZfkafDkfy__GkC0eyg',
    redirectUri: 'http://localhost',
    refreshToken: '75881225865248-8c8dlhEU_EzfSI0Ukhdn2Mb4ULU_1w'
});

let lastDownloadedVideoId = null;
const sentVideos = new Set();

async function findAndDownload() {
    try {
        const posts = await reddit.getSubreddit('cats').getTop({time: 'day'});

        for (const post of posts) {
            if(post.is_video && post.id !== lastDownloadedVideoId && !sentVideos.has(post.id)) {
                console.log(`Found a video: ${post.url}`);

                const videoResponse = await axios.get(post.media.reddit_video.fallback_url, {
                    responseType: 'stream'
                });

                const videoStream = fs.createWriteStream('video.mp4');
                videoResponse.data.pipe(videoStream);

                console.log(`Video downloaded`);

                videoStream.on('finish', () => {
                    bot.sendVideo(chatId, 'video.mp4', {
                        reply_markup: {
                            inline_keyboard: [
                                [
                                    {text: 'Delete', callback_data: 'delete'},
                                    {text: 'Approve', callback_data: 'approve'}
                                ]
                            ]
                        }
                    }).then(() => {
                        console.log(`Video sent`);
                        sentVideos.add(post.id);
                        lastDownloadedVideoId = post.id;
                        /*
                        setTimeout(() => {
                            fs.unlinkSync('video.mp4');
                        }, 10000);

                         */
                    }).catch((err) => {
                        console.error(err);
                    });
                });
                return;
            }
        }
        console.log('No new videos found');
    } catch (error) {
        console.error(error);
    }
}

bot.on('callback_query', (query) => {
    const chatId = query.message.chat.id;
    const messageId = query.message.message_id;

    if(query.data === 'delete') {
        bot.deleteMessage(chatId, messageId.toString()).then(() => {
            console.log('Video deleted');
        }).catch((err) => {
            console.error(err);
        })
    } else if(query.data === 'approve') {

    }
})

bot.on('polling_error', (error) => {
    console.log(error);
})

bot.onText(/\/getVideo/, (msg) => {
    const chatId = msg.chat.id;
    findAndDownload(chatId);
})
findAndDownload();
setInterval(findAndDownload, 5 * 60 * 1000);