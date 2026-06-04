const fs = require('fs');
let code = fs.readFileSync('src/index.js', 'utf-8');

// 1. Remove nugas imports
code = code.replace(`import { buildNugasReply, buildNugasWelcomeEmbed } from './nugas.js';\n`, '');

// 2. Make ping aesthetic
const oldPing = `    if (interaction.commandName === 'ping') {
      await interaction.reply({ content: 'pong', ephemeral: true });
      return;
    }`;
const newPing = `    if (interaction.commandName === 'ping') {
      const pingEmbed = new EmbedBuilder()
        .setTitle('🏓 Pong!')
        .setDescription(\`**Latency:** \\\`\${Date.now() - interaction.createdTimestamp}ms\\\`\\n**API:** \\\`\${Math.round(client.ws.ping)}ms\\\`\`)
        .setColor(0x5865F2);
      await interaction.reply({ embeds: [pingEmbed], ephemeral: true });
      return;
    }`;
code = code.replace(oldPing, newPing);

// 3. Make standup modal aesthetic
const oldStandupModal = `    const embed = new EmbedBuilder()
      .setTitle('Daily Standup')
      .setColor(0x5865f2)
      .setAuthor({
        name: interaction.user.tag,
        iconURL: interaction.user.displayAvatarURL()
      })
      .addFields(
        { name: 'Done', value: done || '-', inline: false },
        { name: 'Doing', value: doing || '-', inline: false },
        { name: 'Blocker', value: blocker || '-', inline: false },
        { name: 'ETA', value: eta || '-', inline: false }
      )
      .setFooter({ text: \`ID #\${standupId}\` })
      .setTimestamp(new Date(createdAt));`;
const newStandupModal = `    const embed = new EmbedBuilder()
      .setTitle('🌅 Daily Standup')
      .setColor(0x57F287)
      .setAuthor({
        name: interaction.user.username,
        iconURL: interaction.user.displayAvatarURL()
      })
      .addFields(
        { name: '✅ Done', value: done ? \`> \${done.replace(/\\n/g, '\\n> ')}\` : '> -', inline: false },
        { name: '🚀 Doing', value: doing ? \`> \${doing.replace(/\\n/g, '\\n> ')}\` : '> -', inline: false },
        { name: '🛑 Blocker', value: blocker ? \`> \${blocker.replace(/\\n/g, '\\n> ')}\` : '> -', inline: false },
        { name: '⏱️ ETA', value: eta ? \`\\\`\${eta}\\\`\` : '\\\`Tidak ada\\\`', inline: true }
      )
      .setFooter({ text: \`Standup ID #\${standupId}\` })
      .setTimestamp(new Date(createdAt));`;
code = code.replace(oldStandupModal, newStandupModal);

// 4. Extract play command and reconstruct commands part
const beforeCommands = code.substring(0, code.indexOf(`    if (interaction.commandName === 'todo') {`));
const afterCommands = code.substring(code.indexOf(`    await interaction.reply({`));

const cleanCommands = `    if (interaction.commandName === 'standup') {
      const modal = new ModalBuilder()
        .setCustomId('standup_modal_v1')
        .setTitle('🌅 Daily Standup');

      const done = new TextInputBuilder()
        .setCustomId('done')
        .setLabel('✅ Done (Kemarin/Baru selesai)')
        .setPlaceholder('Contoh: Selesai setup VPS')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(false)
        .setMaxLength(1000);

      const doing = new TextInputBuilder()
        .setCustomId('doing')
        .setLabel('🚀 Doing (Fokus hari ini)')
        .setPlaceholder('Contoh: Bikin fitur 9router')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setMaxLength(1000);

      const blocker = new TextInputBuilder()
        .setCustomId('blocker')
        .setLabel('🛑 Blocker (Hambatan)')
        .setPlaceholder('Contoh: Belum ngerti auth')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(false)
        .setMaxLength(1000);

      const eta = new TextInputBuilder()
        .setCustomId('eta')
        .setLabel('⏱️ ETA (Perkiraan Selesai)')
        .setPlaceholder('Contoh: Nanti malam')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setMaxLength(200);

      modal.addComponents(
        new ActionRowBuilder().addComponents(done),
        new ActionRowBuilder().addComponents(doing),
        new ActionRowBuilder().addComponents(blocker),
        new ActionRowBuilder().addComponents(eta)
      );

      await interaction.showModal(modal);
      return;
    }

    if (interaction.commandName === 'play') {
      await handlePlayCommand({ client, interaction });
      return;
    }

`;

code = beforeCommands + cleanCommands + afterCommands;

// 5. Remove MessageCreate event handler
const msgCreateIdx = code.indexOf(`client.on(Events.MessageCreate, async (message) => {`);
if (msgCreateIdx > -1) {
  code = code.substring(0, code.indexOf(`client.login(ENV.DISCORD_TOKEN);`) + `client.login(ENV.DISCORD_TOKEN);\n`.length);
}

fs.writeFileSync('src/index.js', code);
console.log('src/index.js successfully rewritten');
