import { SlashCommandBuilder, ChannelType } from 'discord.js';
import { createEmbed, errorEmbed, successEmbed } from '../../../utils/embeds.js';
import { logger } from '../../../utils/logger.js';
import { handleInteractionError } from '../../../utils/errorHandler.js';
import { InteractionHelper } from '../../../utils/interactionHelper.js';
import { getColor } from '../../../config/bot.js';
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  entersState,
} from '@discordjs/voice';
import ytdl from 'ytdl-core';

export default {
  data: new SlashCommandBuilder()
    .setName('music')
    .setDescription('Music commands')
    .addSubcommand(sub =>
      sub
        .setName('play')
        .setDescription('Play a YouTube video in your voice channel')
        .addStringOption(opt =>
          opt
            .setName('url')
            .setDescription('YouTube URL')
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName('stop').setDescription('Stop music and leave voice channel')
    ),

  async execute(interaction) {
    try {
      const sub = interaction.options.getSubcommand();

      if (sub === 'play') {
        const url = interaction.options.getString('url');

        // تأكد المستخدم في روم صوتي
        const voiceChannel = interaction.member?.voice?.channel;
        if (!voiceChannel) {
          return interaction.reply({
            embeds: [errorEmbed('لازم تكون في روم صوتي!')],
            ephemeral: true,
          });
        }

        // تحقق إن الرابط يوتيوب
        if (!ytdl.validateURL(url)) {
          return interaction.reply({
            embeds: [errorEmbed('رابط YouTube غير صحيح!')],
            ephemeral: true,
          });
        }

        await interaction.deferReply();

        // ادخل الروم الصوتي
        const connection = joinVoiceChannel({
          channelId: voiceChannel.id,
          guildId: interaction.guild.id,
          adapterCreator: interaction.guild.voiceAdapterCreator,
        });

        // انتظر الاتصال
        await entersState(connection, VoiceConnectionStatus.Ready, 10_000);

        // شغل الصوت
        const stream = ytdl(url, { filter: 'audioonly', quality: 'highestaudio' });
        const resource = createAudioResource(stream);
        const player = createAudioPlayer();

        player.play(resource);
        connection.subscribe(player);

        // جلب معلومات الفيديو
        const info = await ytdl.getBasicInfo(url);
        const title = info.videoDetails.title;

        player.on(AudioPlayerStatus.Idle, () => {
          connection.destroy();
        });

        player.on('error', err => {
          logger.error('Music player error:', err);
          connection.destroy();
        });

        return interaction.editReply({
          embeds: [
            createEmbed({
              title: '🎵 Now Playing',
              description: `**${title}**`,
              fields: [
                { name: 'Channel', value: voiceChannel.name, inline: true },
                { name: 'Requested by', value: interaction.user.tag, inline: true },
              ],
            }),
          ],
        });
      }

      if (sub === 'stop') {
        const voiceChannel = interaction.member?.voice?.channel;
        if (!voiceChannel) {
          return interaction.reply({
            embeds: [errorEmbed('أنت مو في روم صوتي!')],
            ephemeral: true,
          });
        }

        const connection = interaction.client.voice?.adapters?.get(interaction.guild.id);
        if (connection) {
          connection.destroy();
        }

        return interaction.reply({
          embeds: [createEmbed({ title: '⏹️ Stopped', description: 'تم إيقاف الموسيقى.' })],
        });
      }
    } catch (error) {
      handleInteractionError(error, interaction);
    }
  },
};
