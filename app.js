const snoowrap = require('snoowrap');
const fs = require('fs');
const TelegramBot = require('node-telegram-bot-api');
const util = require('util');
const axios = require("axios");
const exec = util.promisify(require('child_process').exec);
const FormData = require('form-data');
const ffmpeg = require('ffmpeg-static');
console.log(ffmpeg);

const botToken = '6477451489:AAHwbqc36IP33bCkxib2UGSVvhk7qcqeY9A'
bot = new TelegramBot(botToken, {polling: true});
const chatId = '1092856248';
const channelName = '@CatosMemos';

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
let videoCounter = 1;

function loadVideoData() {
    try {
        const data = fs.readFileSync('videoData.json');
        return JSON.parse(data);
    } catch (error) {
        return {};
    }
}

videoData = loadVideoData();

async function downloadVideo(url) {
    try {
        const videoName = `video${videoCounter}.mp4`;
        const mpdUrl = `${url}/DASHPlaylist.mpd`;
        const {stdout, stderr} = await exec(`${ffmpeg} -i ${mpdUrl} -c copy ${videoName}`);
        if(stderr) {
            console.error('Error:', stderr);
            return false;
        }
        console.log('Video downloaded');
        return true;
    } catch (e) {
        console.error(e);
        return false;
    }
}
module.exports = downloadVideo;

async function findAndDownload() {
    try {
        const funnyAnimalsReddit = await reddit.getSubreddit('FunnyAnimals').getHot({time: 'day'});
        const videoName = `video${videoCounter}.mp4`;
        // const allReddits = [...funnyAnimalsReddit, // add some other subreddits];
        for (const post of funnyAnimalsReddit) {
            if (post.is_video && post.id !== lastDownloadedVideoId && !sentVideos.has(post.id)) {
                console.log(`Found a video: ${post.url}`);

                const downloadSuccess = await downloadVideo(post.url);

                setTimeout(() => {
                    fs.access(videoName, fs.constants.F_OK, (err) => {
                        if (!err) {

                            bot.sendVideo(chatId, videoName, {
                                reply_markup: {
                                    inline_keyboard: [
                                        [
                                            { text: 'Delete', callback_data: 'delete' },
                                            { text: 'Approve', callback_data: 'approve' }
                                        ]
                                    ]
                                }
                            }).then(() => {
                                console.log(`Video ${videoName} sent`);
                                sentVideos.add(post.id);
                                lastDownloadedVideoId = post.id;
                                videoCounter++;
                            })
                        } else {
                            console.log('Video download failed')
                        }
                    })
                }, 15000)
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
    const videoPath = `video${videoCounter - 1}.mp4`;

    if (query.data === 'delete') {
        bot.deleteMessage(chatId, messageId.toString()).then(() => {
            fs.unlinkSync(videoPath);
            console.log('Video deleted');
            videoCounter--;

            bot.sendMessage(chatId, 'Deleted').then((sent) => {
                setTimeout(() => {
                    bot.deleteMessage(chatId, sent.message_id.toString());
                }, 5000)
            })
        }).catch((err) => {
            console.error(err);
        });
    } else if (query.data === 'approve') {
        const telegramWebhook = `https://api.telegram.org/bot${botToken}/sendVideo`;
        const discordWebhook = 'https://discord.com/api/webhooks/1190282633947660379/J5cdKFvskUIZfRsCYAaWydBSJ85ybOWm3Fag6gQ0TMKhzui3T8gZVf1UgXF1NoaChcNq';
        const form = new FormData();
        form.append('chat_id', channelName);
        form.append('content', '');
        form.append('file', fs.createReadStream(videoPath), videoPath);
        axios.post(discordWebhook, form, telegramWebhook,{
            headers: {
                ...form.getHeaders(),
            },
        }).then(() => {
            bot.sendVideo(channelName, fs.createReadStream(videoPath)).then(() => {
                console.log(`Video ${videoPath} sent to Telegram`);
                setTimeout(() => {
                    bot.sendChatAction(channelName, '👍').then(() => {
                        console.log('Liked');
                    }).catch((e) => {
                        console.error(e);
                    });
                    bot.sendChatAction(channelName, '👎').then(() => {
                        console.log('Disliked');
                    }).catch((e) => {
                        console.error(e);
                    });
                }, 5000);
            });

            console.log(`Video ${videoPath} sent to Discord`);
            bot.deleteMessage(chatId, messageId.toString()).then(() => {
                fs.unlinkSync(videoPath);
                videoCounter--;

                bot.sendMessage(chatId, 'Approved').then((sent) => {
                    setTimeout(() => {
                        bot.deleteMessage(chatId, sent.message_id.toString());
                    }, 5000);
                });
            })
        }).catch((e) => {
            console.error(e);
        });
    }
});

bot.on('polling_error', (error) => {
    console.log(error);
})

bot.onText(/\/getVideo/, (msg) => {
    const chatId = msg.chat.id;
    findAndDownload(chatId);
})
findAndDownload();
setInterval(findAndDownload, 15 * 60 * 1000);