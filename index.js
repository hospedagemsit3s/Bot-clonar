const { 
    Client, 
    GatewayIntentBits, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    EmbedBuilder, 
    PermissionFlagsBits,
    ChannelType
} = require('discord.js');
const http = require('http');
require('dotenv').config();

// Servidor HTTP para a Render
http.createServer((req, res) => {
    res.write("Bot Online!");
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

client.once('ready', () => {
    console.log(`Bot logado como ${client.user.tag}!`);
});

client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.content.startsWith(PREFIX)) return;

    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    if (command === 'setup') {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return message.reply('Você precisa de permissão de Administrador para usar este comando.');
        }

        const embed = new EmbedBuilder()
            .setTitle('Clonar Servidor')
            .setDescription('Escolha o que será apagado do servidor de destino e o que será clonado do servidor de origem. Clique em Continuar para prosseguir.')
            .setColor('#5865F2');

        const row1 = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder().setCustomId('del_channels').setLabel('Apagar Canais').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('del_roles').setLabel('Apagar Cargos').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('del_emojis').setLabel('Apagar Emojis').setStyle(ButtonStyle.Secondary),
            );

        const row2 = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder().setCustomId('clone_channels').setLabel('Clonar Canais').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('clone_roles').setLabel('Clonar Cargos').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('clone_emojis').setLabel('Clonar Emojis').setStyle(ButtonStyle.Secondary),
            );

        const row3 = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder().setCustomId('continue').setLabel('Continuar').setStyle(ButtonStyle.Success),
            );

        await message.channel.send({ embeds: [embed], components: [row1, row2, row3] });
    }
});

const userSelections = new Map();

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;

    const userId = interaction.user.id;
    if (!userSelections.has(userId)) {
        userSelections.set(userId, {
            del_channels: false, del_roles: false, del_emojis: false,
            clone_channels: false, clone_roles: false, clone_emojis: false
        });
    }

    const selections = userSelections.get(userId);

    if (interaction.customId === 'continue') {
        await interaction.reply({ content: 'Por favor, envie o ID do servidor de ORIGEM:', ephemeral: true });
        
        const filter = m => m.author.id === userId;
        const collector = interaction.channel.createMessageCollector({ filter, time: 60000, max: 1 });

        collector.on('collect', async m => {
            const sourceGuildId = m.content.trim();
            const sourceGuild = client.guilds.cache.get(sourceGuildId);

            if (!sourceGuild) {
                return interaction.followUp({ content: 'Não encontrei o servidor de origem. Verifique se eu estou nele!', ephemeral: true });
            }

            await interaction.followUp({ content: '🚀 Iniciando clonagem completa...', ephemeral: true });
            
            try {
                const targetGuild = interaction.guild;

                // 1. APAGAR
                if (selections.del_channels) {
                    const channels = await targetGuild.channels.fetch();
                    for (const channel of channels.values()) {
                        try { await channel.delete(); } catch (e) {}
                    }
                }

                if (selections.del_roles) {
                    const roles = await targetGuild.roles.fetch();
                    for (const role of roles.values()) {
                        if (role.editable && role.name !== '@everyone' && !role.managed) {
                            try { await role.delete(); } catch (e) {}
                        }
                    }
                }

                if (selections.del_emojis) {
                    const emojis = await targetGuild.emojis.fetch();
                    for (const emoji of emojis.values()) {
                        try { await emoji.delete(); } catch (e) {}
                    }
                }

                // 2. CLONAR CARGOS (E mapear IDs)
                const roleMap = new Map();
                if (selections.clone_roles) {
                    const roles = await sourceGuild.roles.fetch();
                    const sortedRoles = Array.from(roles.values()).sort((a, b) => a.position - b.position);
                    
                    for (const role of sortedRoles) {
                        if (role.name === '@everyone') {
                            await targetGuild.roles.everyone.setPermissions(role.permissions);
                            roleMap.set(role.id, targetGuild.roles.everyone.id);
                            continue;
                        }
                        if (!role.managed) {
                            const newRole = await targetGuild.roles.create({
                                name: role.name,
                                color: role.color,
                                permissions: role.permissions,
                                hoist: role.hoist,
                                mentionable: role.mentionable
                            });
                            roleMap.set(role.id, newRole.id);
                        }
                    }
                }

                // 3. CLONAR CANAIS (Categorias primeiro, depois canais)
                if (selections.clone_channels) {
                    const sourceChannels = await sourceGuild.channels.fetch();
                    const categoryMap = new Map();

                    // Primeiro: Categorias
                    const categories = sourceChannels.filter(c => c.type === ChannelType.GuildCategory);
                    for (const cat of categories.values()) {
                        const newCat = await targetGuild.channels.create({
                            name: cat.name,
                            type: ChannelType.GuildCategory,
                            permissionOverwrites: cat.permissionOverwrites.cache.map(ov => ({
                                id: roleMap.get(ov.id) || ov.id,
                                allow: ov.allow,
                                deny: ov.deny,
                                type: ov.type
                            }))
                        });
                        categoryMap.set(cat.id, newCat.id);
                    }

                    // Segundo: Canais de Texto e Voz
                    const otherChannels = sourceChannels.filter(c => c.type !== ChannelType.GuildCategory);
                    for (const chan of otherChannels.values()) {
                        if ([ChannelType.GuildText, ChannelType.GuildVoice, ChannelType.GuildAnnouncement].includes(chan.type)) {
                            await targetGuild.channels.create({
                                name: chan.name,
                                type: chan.type,
                                parent: categoryMap.get(chan.parentId),
                                nsfw: chan.nsfw,
                                topic: chan.topic,
                                rateLimitPerUser: chan.rateLimitPerUser,
                                permissionOverwrites: chan.permissionOverwrites.cache.map(ov => ({
                                    id: roleMap.get(ov.id) || ov.id,
                                    allow: ov.allow,
                                    deny: ov.deny,
                                    type: ov.type
                                }))
                            });
                        }
                    }
                }

                // 4. CLONAR EMOJIS
                if (selections.clone_emojis) {
                    const emojis = await sourceGuild.emojis.fetch();
                    for (const emoji of emojis.values()) {
                        try { await targetGuild.emojis.create({ attachment: emoji.url, name: emoji.name }); } catch (e) {}
                    }
                }

                await interaction.followUp({ content: '✅ Clonagem completa realizada com sucesso!', ephemeral: true });
            } catch (error) {
                console.error(error);
                await interaction.followUp({ content: '❌ Erro na clonagem. Verifique minhas permissões!', ephemeral: true });
            }
        });
    });

    // Alternar estado dos botões
    if (interaction.customId !== 'continue') {
        selections[interaction.customId] = !selections[interaction.customId];
        const rows = interaction.message.components.map(row => {
            const newRow = ActionRowBuilder.from(row);
            newRow.components.forEach(button => {
                if (button.data.custom_id === interaction.customId) {
                    button.setStyle(selections[interaction.customId] ? ButtonStyle.Primary : ButtonStyle.Secondary);
                }
            });
            return newRow;
        });
        await interaction.update({ components: rows });
    }
});

client.login(process.env.TOKEN);
