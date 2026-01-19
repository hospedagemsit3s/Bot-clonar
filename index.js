const { 
    Client, 
    GatewayIntentBits, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    EmbedBuilder, 
    StringSelectMenuBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ChannelType
} = require('discord.js');
const { Client: SelfClient } = require('discord.js-selfbot-v13');
const http = require('http');
require('dotenv').config();

// Servidor HTTP para a Render
http.createServer((req, res) => {
    res.write("Bot Multi-Tools Online!");
    res.end();
}).listen(process.env.PORT || 3000);

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildEmojisAndStickers
    ]
});

const PREFIX = '!';
const OWNER_ID = '1225647692458229860'; // <--- COLOQUE SEU ID AQUI
let vips = new Set(); 

const EMOJIS = {
    clone: '<:1289969947199410249:1461879272586084497>', 
    bot: '<a:1289359703763324958:1461879286737666272>',
    clear: '<:1225477825285328979:1461879284032475136>',
    trash: '<:lixeira:1453320418076266567>'
};

client.once('ready', () => {
    console.log(`Bot Multi-Tools logado como ${client.user.tag}!`);
});

client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.content.startsWith(PREFIX)) return;

    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    if (message.author.id === OWNER_ID && command === 'addvip') {
        const user = message.mentions.users.first() || await client.users.fetch(args[0]).catch(() => null);
        if (!user) return message.reply('❌ Mencione um usuário ou envie o ID.');
        vips.add(user.id);
        return message.reply(`✅ **${user.tag}** agora é VIP!`);
    }

    if (command === 'tools' || command === 'setup') {
        if (!vips.has(message.author.id) && message.author.id !== OWNER_ID) {
            return message.reply('❌ Acesso restrito a usuários VIP.');
        }

        const embed = new EmbedBuilder()
            .setTitle('🛠️ Central de Ferramentas VIP')
            .setDescription('Selecione uma das funções abaixo para iniciar o processo.')
            .setColor('#2F3136')
            .addFields(
                { name: '📂 Clonagem de Servidor', value: 'Copie canais, cargos e emojis.', inline: true },
                { name: '🧹 Limpeza de DM', value: 'Apague suas mensagens no privado.', inline: true },
                { name: '🗑️ Limpeza de Servidor', value: 'Delete canais e cargos rapidamente.', inline: true }
            );

        const rowSelect = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('select_tool')
                .setPlaceholder('✨ Selecionar uma opção...')
                .addOptions([
                    { label: 'Clonar Servidor (Via Conta)', value: 'tool_clone_self', emoji: EMOJIS.clone },
                    { label: 'Clonar Servidor (Via Bot)', value: 'tool_clone_bot', emoji: EMOJIS.bot },
                    { label: 'Limpar Mensagens DM', value: 'tool_clear_dm', emoji: EMOJIS.clear },
                    { label: 'Limpar Servidor Atual', value: 'tool_clear_guild', emoji: EMOJIS.trash },
                ]),
        );

        await message.channel.send({ embeds: [embed], components: [rowSelect] });
    }
});

const globalCloneData = {};

client.on('interactionCreate', async (interaction) => {
    const userId = interaction.user.id;

    if (interaction.isStringSelectMenu()) {
        if (interaction.customId === 'select_tool') {
            const tool = interaction.values[0];
            
            if (tool.startsWith('tool_clone')) {
                const modal = new ModalBuilder()
                    .setCustomId(tool === 'tool_clone_self' ? 'modal_clone_self' : 'modal_clone_bot')
                    .setTitle('Configurar Clonagem');
                
                const rows = [
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('source').setLabel('ID do Servidor de ORIGEM').setStyle(TextInputStyle.Short).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('target').setLabel('ID do Servidor de DESTINO').setStyle(TextInputStyle.Short).setRequired(true))
                ];

                if (tool === 'tool_clone_self') {
                    rows.unshift(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('token').setLabel('Token da Conta').setStyle(TextInputStyle.Short).setRequired(true)));
                }

                modal.addComponents(rows);
                await interaction.showModal(modal);
            } else if (tool === 'tool_clear_dm') {
                const modal = new ModalBuilder().setCustomId('modal_clear_dm').setTitle('Limpeza de DM');
                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('token').setLabel('Token da Conta').setStyle(TextInputStyle.Short).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('channel_id').setLabel('ID do Canal da DM').setStyle(TextInputStyle.Short).setRequired(true))
                );
                await interaction.showModal(modal);
            } else if (tool === 'tool_clear_guild') {
                const modal = new ModalBuilder().setCustomId('modal_clear_guild').setTitle('Limpeza de Servidor');
                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('confirm').setLabel('Digite "CONFIRMAR" para apagar tudo').setStyle(TextInputStyle.Short).setRequired(true))
                );
                await interaction.showModal(modal);
            }
        }
    }

    if (interaction.isModalSubmit()) {
        if (interaction.customId.startsWith('modal_clone')) {
            const sourceId = interaction.fields.getTextInputValue('source');
            const targetId = interaction.fields.getTextInputValue('target');
            const token = interaction.customId === 'modal_clone_self' ? interaction.fields.getTextInputValue('token') : null;

            await interaction.reply({ content: '🔍 Verificando servidores...', ephemeral: true });

            try {
                let sourceName, targetName;
                if (token) {
                    const self = new SelfClient();
                    await self.login(token);
                    sourceName = self.guilds.cache.get(sourceId)?.name;
                    self.destroy();
                } else {
                    sourceName = client.guilds.cache.get(sourceId)?.name;
                }
                targetName = client.guilds.cache.get(targetId)?.name;

                if (!sourceName || !targetName) return interaction.followUp({ content: '❌ Servidor não encontrado.', ephemeral: true });

                const cloneKey = `key_${userId}`;
                globalCloneData[cloneKey] = { sourceId, targetId, token, selections: {} };

                const embed = new EmbedBuilder()
                    .setTitle('⚙️ O que você deseja clonar?')
                    .setDescription(`**Origem:** ${sourceName}\n**Destino:** ${targetName}\n\nSelecione as opções abaixo e clique em Confirmar.`)
                    .setColor('#5865F2');

                const row1 = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('opt_channels').setLabel('Canais/Categorias').setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId('opt_roles').setLabel('Cargos').setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId('opt_emojis').setLabel('Emojis').setStyle(ButtonStyle.Secondary),
                );

                const row2 = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('opt_info').setLabel('Foto/Nome').setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId('confirm_clone').setLabel('CONFIRMAR CLONAGEM').setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId('cancel_clone').setLabel('CANCELAR').setStyle(ButtonStyle.Danger),
                );

                await interaction.followUp({ embeds: [embed], components: [row1, row2], ephemeral: true });
            } catch (e) { await interaction.followUp({ content: '❌ Erro ao verificar servidores.', ephemeral: true }); }
        }
        // ... outras lógicas de modal (DM, Clear Guild) ...
    }

    if (interaction.isButton()) {
        const cloneKey = `key_${userId}`;
        const data = globalCloneData[cloneKey];

        if (interaction.customId.startsWith('opt_')) {
            if (!data) return interaction.reply({ content: '❌ Sessão expirada.', ephemeral: true });
            const option = interaction.customId.replace('opt_', '');
            data.selections[option] = !data.selections[option];

            const rows = interaction.message.components.map(row => {
                const newRow = ActionRowBuilder.from(row);
                newRow.components.forEach(button => {
                    if (button.data.custom_id === interaction.customId) {
                        button.setStyle(data.selections[option] ? ButtonStyle.Primary : ButtonStyle.Secondary);
                    }
                });
                return newRow;
            });
            return await interaction.update({ components: rows });
        }

        if (interaction.customId === 'confirm_clone') {
            if (!data) return interaction.reply({ content: '❌ Sessão expirada.', ephemeral: true });
            await interaction.update({ content: '🚀 Clonagem iniciada! Aguarde...', embeds: [], components: [] });
            
            try {
                const { sourceId, targetId, token, selections } = data;
                let sourceGuild;
                if (token) {
                    const self = new SelfClient();
                    await self.login(token);
                    sourceGuild = await self.guilds.fetch(sourceId);
                    await executeClone(sourceGuild, client.guilds.cache.get(targetId), selections);
                    self.destroy();
                } else {
                    sourceGuild = await client.guilds.fetch(sourceId);
                    await executeClone(sourceGuild, client.guilds.cache.get(targetId), selections);
                }
                await interaction.followUp({ content: '✅ Clonagem concluída com sucesso!', ephemeral: true });
            } catch (err) { await interaction.followUp({ content: '❌ Erro durante a clonagem.', ephemeral: true }); }
            finally { delete globalCloneData[cloneKey]; }
        }
    }
});

async function executeClone(sourceGuild, targetGuild, opts) {
    if (opts.info) {
        await targetGuild.setName(sourceGuild.name).catch(() => {});
        if (sourceGuild.iconURL()) await targetGuild.setIcon(sourceGuild.iconURL()).catch(() => {});
    }

    if (opts.channels) {
        const channels = await targetGuild.channels.fetch();
        for (const c of channels.values()) await c.delete().catch(() => {});
    }

    const roleMap = new Map();
    if (opts.roles) {
        const roles = await targetGuild.roles.fetch();
        for (const r of roles.values()) if (r.editable && r.name !== '@everyone' && !r.managed) await r.delete().catch(() => {});
        
        const sRoles = Array.from((await sourceGuild.roles.fetch()).values()).sort((a, b) => a.position - b.position);
        for (const r of sRoles) {
            if (r.name === '@everyone') {
                await targetGuild.roles.everyone.setPermissions(r.permissions);
                roleMap.set(r.id, targetGuild.roles.everyone.id);
            } else if (!r.managed) {
                const nr = await targetGuild.roles.create({ name: r.name, color: r.color, permissions: r.permissions, hoist: r.hoist, mentionable: r.mentionable });
                roleMap.set(r.id, nr.id);
            }
        }
    }

    if (opts.channels) {
        const sChannels = await sourceGuild.channels.fetch();
        const catMap = new Map();
        const cats = Array.from(sChannels.filter(c => c.type === ChannelType.GuildCategory || c.type === 'GUILD_CATEGORY').values()).sort((a, b) => a.position - b.position);
        for (const c of cats) {
            const nc = await targetGuild.channels.create({ name: c.name, type: ChannelType.GuildCategory, permissionOverwrites: c.permissionOverwrites.cache.map(o => ({ id: roleMap.get(o.id) || o.id, allow: o.allow, deny: o.deny, type: o.type })) });
            catMap.set(c.id, nc.id);
        }
        const others = Array.from(sChannels.filter(c => c.type !== ChannelType.GuildCategory && c.type !== 'GUILD_CATEGORY').values()).sort((a, b) => a.position - b.position);
        for (const c of others) {
            if ([ChannelType.GuildText, ChannelType.GuildVoice, ChannelType.GuildAnnouncement, 'GUILD_TEXT', 'GUILD_VOICE'].includes(c.type)) {
                await targetGuild.channels.create({ name: c.name, type: c.type === 'GUILD_TEXT' ? ChannelType.GuildText : (c.type === 'GUILD_VOICE' ? ChannelType.GuildVoice : c.type), parent: catMap.get(c.parentId), permissionOverwrites: c.permissionOverwrites.cache.map(o => ({ id: roleMap.get(o.id) || o.id, allow: o.allow, deny: o.deny, type: o.type })) });
            }
        }
    }

    if (opts.emojis) {
        const sEmojis = await sourceGuild.emojis.fetch();
        for (const e of sEmojis.values()) await targetGuild.emojis.create({ attachment: e.url, name: e.name }).catch(() => {});
    }
}

client.login(process.env.TOKEN);
