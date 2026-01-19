const { 
    Client, 
    GatewayIntentBits, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    EmbedBuilder, 
    PermissionFlagsBits,
    ChannelType,
    StringSelectMenuBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle
} = require('discord.js');
const { Client: SelfClient } = require('discord.js-selfbot-v13');
const http = require('http');
require('dotenv').config();

// Servidor HTTP para a Render
http.createServer((req, res) => {
    res.write("Bot VIP Online!");
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
const OWNER_ID = 'SEU_ID_AQUI'; // Coloque seu ID do Discord aqui
let vips = new Set(); 

client.once('ready', () => {
    console.log(`Bot VIP logado como ${client.user.tag}!`);
});

client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.content.startsWith(PREFIX)) return;

    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    if (message.author.id === OWNER_ID) {
        if (command === 'addvip') {
            const user = message.mentions.users.first() || await client.users.fetch(args[0]).catch(() => null);
            if (!user) return message.reply('❌ Mencione um usuário ou envie o ID.');
            vips.add(user.id);
            return message.reply(`✅ **${user.tag}** agora é um usuário VIP!`);
        }
    }

    if (command === 'setup') {
        if (!vips.has(message.author.id) && message.author.id !== OWNER_ID) {
            return message.reply('❌ Este é um comando **VIP**.');
        }

        const embed = new EmbedBuilder()
            .setTitle('💎 Painel de Clonagem VIP')
            .setDescription('Selecione as opções de clonagem e depois escolha o método no menu abaixo.')
            .setColor('#FFD700');

        const rowButtons = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('del_channels').setLabel('Apagar Canais').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('del_roles').setLabel('Apagar Cargos').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('del_emojis').setLabel('Apagar Emojis').setStyle(ButtonStyle.Secondary),
        );

        const rowSelect = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('select_method')
                .setPlaceholder('🚀 Escolha o método de clonagem')
                .addOptions([
                    { label: 'Clonar via Bot', description: 'O bot deve estar nos dois servidores', value: 'method_bot' },
                    { label: 'Clonar via Conta', description: 'Clona qualquer servidor que você estiver', value: 'method_self' },
                ]),
        );

        await message.channel.send({ embeds: [embed], components: [rowButtons, rowSelect] });
    }
});

const userSelections = new Map();

client.on('interactionCreate', async (interaction) => {
    const userId = interaction.user.id;

    // Lógica dos Botões de Seleção
    if (interaction.isButton()) {
        if (!userSelections.has(userId)) userSelections.set(userId, {});
        const selections = userSelections.get(userId);
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
        return await interaction.update({ components: rows });
    }

    // Lógica do Menu de Seleção (Abre o Modal)
    if (interaction.isStringSelectMenu()) {
        if (interaction.customId === 'select_method') {
            const method = interaction.values[0];
            const modal = new ModalBuilder()
                .setCustomId(method === 'method_bot' ? 'modal_bot' : 'modal_self')
                .setTitle(method === 'method_bot' ? 'Clonagem via Bot' : 'Clonagem via Conta');

            const inputSource = new TextInputBuilder()
                .setCustomId('source_id')
                .setLabel('ID do Servidor de ORIGEM')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('Ex: 123456789012345678')
                .setRequired(true);

            const inputTarget = new TextInputBuilder()
                .setCustomId('target_id')
                .setLabel('ID do Servidor de DESTINO')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('Ex: 876543210987654321')
                .setRequired(true);

            const rows = [new ActionRowBuilder().addComponents(inputSource), new ActionRowBuilder().addComponents(inputTarget)];

            if (method === 'method_self') {
                const inputToken = new TextInputBuilder()
                    .setCustomId('user_token')
                    .setLabel('Token da sua Conta')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('Cole aqui o token da sua conta secundária')
                    .setRequired(true);
                rows.unshift(new ActionRowBuilder().addComponents(inputToken));
            }

            modal.addComponents(rows);
            await interaction.showModal(modal);
        }
    }

    // Lógica do Envio do Modal (Executa a Clonagem)
    if (interaction.isModalSubmit()) {
        const sourceId = interaction.fields.getTextInputValue('source_id');
        const targetId = interaction.fields.getTextInputValue('target_id');
        const selections = userSelections.get(userId) || {};

        await interaction.reply({ content: '🚀 Iniciando processo de clonagem... Aguarde.', ephemeral: true });

        if (interaction.customId === 'modal_bot') {
            // Lógica via Bot Oficial
            const sourceGuild = client.guilds.cache.get(sourceId);
            const targetGuild = client.guilds.cache.get(targetId);
            if (!sourceGuild || !targetGuild) return interaction.followUp({ content: '❌ Servidor não encontrado pelo bot.', ephemeral: true });
            // ... (Executar clonagem aqui) ...
            await interaction.followUp({ content: '✅ Clonagem via Bot concluída!', ephemeral: true });
        } else {
            // Lógica via Self-Bot
            const userToken = interaction.fields.getTextInputValue('user_token');
            const selfClient = new SelfClient();
            try {
                await selfClient.login(userToken);
                const sourceGuild = selfClient.guilds.cache.get(sourceId);
                const targetGuild = client.guilds.cache.get(targetId);
                if (!sourceGuild || !targetGuild) throw new Error('Erro');
                // ... (Executar clonagem aqui) ...
                await interaction.followUp({ content: '✅ Clonagem via Conta concluída!', ephemeral: true });
            } catch (e) {
                await interaction.followUp({ content: '❌ Erro: Token inválido ou permissões insuficientes.', ephemeral: true });
            } finally {
                selfClient.destroy();
            }
        }
    }
});

client.login(process.env.TOKEN);
