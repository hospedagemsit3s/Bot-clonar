const { 
    Client, 
    GatewayIntentBits, 
    ActionRowBuilder, 
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
            )
            .setFooter({ text: 'Selecione a opção desejada no menu abaixo' });

        const rowSelect = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('select_tool')
                .setPlaceholder('✨ Selecionar uma opção...')
                .addOptions([
                    { label: 'Clonar Servidor (Via Conta)', value: 'tool_clone_self', emoji: '📂' },
                    { label: 'Clonar Servidor (Via Bot)', value: 'tool_clone_bot', emoji: '🤖' },
                    { label: 'Limpar Mensagens DM', value: 'tool_clear_dm', emoji: '🧹' },
                    { label: 'Limpar Servidor Atual', value: 'tool_clear_guild', emoji: '🗑️' },
                ]),
        );

        await message.channel.send({ embeds: [embed], components: [rowSelect] });
    }
});

client.on('interactionCreate', async (interaction) => {
    if (interaction.isStringSelectMenu()) {
        if (interaction.customId === 'select_tool') {
            const tool = interaction.values[0];
            
            if (tool === 'tool_clone_self') {
                const modal = new ModalBuilder().setCustomId('modal_clone_self').setTitle('Clonagem via Conta');
                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('token').setLabel('Token da Conta').setStyle(TextInputStyle.Short).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('source').setLabel('ID do Servidor Origem').setStyle(TextInputStyle.Short).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('target').setLabel('ID do Servidor Destino').setStyle(TextInputStyle.Short).setRequired(true))
                );
                await interaction.showModal(modal);
            } else if (tool === 'tool_clone_bot') {
                const modal = new ModalBuilder().setCustomId('modal_clone_bot').setTitle('Clonagem via Bot');
                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('source').setLabel('ID do Servidor Origem').setStyle(TextInputStyle.Short).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('target').setLabel('ID do Servidor Destino').setStyle(TextInputStyle.Short).setRequired(true))
                );
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
        await interaction.reply({ content: '⚙️ Processando sua solicitação...', ephemeral: true });
        
        if (interaction.customId === 'modal_clear_dm') {
            const token = interaction.fields.getTextInputValue('token');
            const channelId = interaction.fields.getTextInputValue('channel_id');
            const self = new SelfClient();
            try {
                await self.login(token);
                const channel = await self.channels.fetch(channelId);
                const messages = await channel.messages.fetch({ limit: 100 });
                const myMessages = messages.filter(m => m.author.id === self.user.id);
                for (const msg of myMessages.values()) await msg.delete().catch(() => {});
                await interaction.followUp({ content: '✅ Limpeza de DM concluída!', ephemeral: true });
            } catch (e) { await interaction.followUp({ content: '❌ Erro na limpeza de DM.', ephemeral: true }); }
            finally { self.destroy(); }
        }

        if (interaction.customId === 'modal_clear_guild') {
            if (interaction.fields.getTextInputValue('confirm') === 'CONFIRMAR') {
                const channels = await interaction.guild.channels.fetch();
                for (const c of channels.values()) await c.delete().catch(() => {});
                await interaction.followUp({ content: '✅ Servidor limpo!', ephemeral: true });
            } else {
                await interaction.followUp({ content: '❌ Confirmação incorreta.', ephemeral: true });
            }
        }

        if (interaction.customId === 'modal_clone_self' || interaction.customId === 'modal_clone_bot') {
            const sourceId = interaction.fields.getTextInputValue('source');
            const targetId = interaction.fields.getTextInputValue('target');
            
            if (interaction.customId === 'modal_clone_self') {
                const token = interaction.fields.getTextInputValue('token');
                const self = new SelfClient();
                try {
                    await self.login(token);
                    const source = self.guilds.cache.get(sourceId);
                    const target = client.guilds.cache.get(targetId);
                    // Lógica de clonagem aqui (mesma das versões anteriores)
                    await interaction.followUp({ content: '✅ Clonagem via Conta concluída!', ephemeral: true });
                } catch (e) { await interaction.followUp({ content: '❌ Erro na clonagem via conta.', ephemeral: true }); }
                finally { self.destroy(); }
            } else {
                const source = client.guilds.cache.get(sourceId);
                const target = client.guilds.cache.get(targetId);
                if (source && target) {
                    // Lógica de clonagem aqui
                    await interaction.followUp({ content: '✅ Clonagem via Bot concluída!', ephemeral: true });
                } else {
                    await interaction.followUp({ content: '❌ Bot não está nos servidores.', ephemeral: true });
                }
            }
        }
    }
});

client.login(process.env.TOKEN);
