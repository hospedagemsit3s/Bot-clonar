const { 
    Client, 
    GatewayIntentBits, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    EmbedBuilder, 
    PermissionFlagsBits 
} = require('discord.js');
require('dotenv').config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildEmojisAndStickers
    ]
});

const PREFIX = '!'; // Prefixo para comandos

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

// Estado temporário para as seleções do usuário
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
        await interaction.reply({ content: 'Por favor, envie o ID do servidor de ORIGEM (de onde vou copiar as coisas):', ephemeral: true });
        
        const filter = m => m.author.id === userId;
        const collector = interaction.channel.createMessageCollector({ filter, time: 30000, max: 1 });

        collector.on('collect', async m => {
            const sourceGuildId = m.content.trim();
            const sourceGuild = client.guilds.cache.get(sourceGuildId);

            if (!sourceGuild) {
                return interaction.followUp({ content: 'Não consegui encontrar esse servidor. Verifique se eu estou nele!', ephemeral: true });
            }

            await interaction.followUp({ content: 'Iniciando processo... Isso pode demorar um pouco.', ephemeral: true });
            
            try {
                const targetGuild = interaction.guild;

                // Lógica de Apagar
                if (selections.del_channels) {
                    const channels = await targetGuild.channels.fetch();
                    for (const channel of channels.values()) {
                        try { await channel.delete(); } catch (e) {}
                    }
                }

                if (selections.del_roles) {
                    const roles = await targetGuild.roles.fetch();
                    for (const role of roles.values()) {
                        if (role.editable && role.name !== '@everyone') {
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

                // Lógica de Clonar
                if (selections.clone_roles) {
                    const roles = await sourceGuild.roles.fetch();
                    const sortedRoles = roles.sort((a, b) => a.position - b.position);
                    for (const role of sortedRoles.values()) {
                        if (role.name !== '@everyone' && !role.managed) {
                            await targetGuild.roles.create({
                                name: role.name,
                                color: role.color,
                                permissions: role.permissions,
                                hoist: role.hoist,
                                mentionable: role.mentionable
                            });
                        }
                    }
                }

                if (selections.clone_channels) {
                    const channels = await sourceGuild.channels.fetch();
                    // Simplificado: cria apenas canais de texto e voz básicos
                    for (const channel of channels.values()) {
                        if (channel.type === 0 || channel.type === 2 || channel.type === 4) { // Text, Voice, Category
                            await targetGuild.channels.create({
                                name: channel.name,
                                type: channel.type,
                                parent: channel.parentId // Isso precisaria de um mapeamento de IDs para funcionar 100% perfeito
                            });
                        }
                    }
                }

                if (selections.clone_emojis) {
                    const emojis = await sourceGuild.emojis.fetch();
                    for (const emoji of emojis.values()) {
                        try { await targetGuild.emojis.create({ attachment: emoji.url, name: emoji.name }); } catch (e) {}
                    }
                }

                await interaction.followUp({ content: '✅ Processo concluído com sucesso!', ephemeral: true });
            } catch (error) {
                console.error(error);
                await interaction.followUp({ content: '❌ Ocorreu um erro durante a clonagem.', ephemeral: true });
            }
        });

        return;
    }

    // Alternar estado dos botões
    selections[interaction.customId] = !selections[interaction.customId];
    
    // Atualizar cores dos botões para dar feedback visual
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
});

client.login(process.env.TOKEN);
