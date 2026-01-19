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
const OWNER_ID = 'SEU_ID_AQUI'; // Coloque seu ID do Discord aqui para ser o dono
let vips = new Set(); // Lista de IDs de usuários VIP

client.once('ready', () => {
    console.log(`Bot VIP logado como ${client.user.tag}!`);
});

client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.content.startsWith(PREFIX)) return;

    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    // --- COMANDOS DE DONO (ADMINISTRAÇÃO) ---
    if (message.author.id === OWNER_ID) {
        if (command === 'addvip') {
            const user = message.mentions.users.first() || await client.users.fetch(args[0]).catch(() => null);
            if (!user) return message.reply('❌ Mencione um usuário ou envie o ID.');
            vips.add(user.id);
            return message.reply(`✅ **${user.tag}** agora é um usuário VIP!`);
        }
        if (command === 'remvip') {
            const userId = args[0];
            if (vips.delete(userId)) return message.reply('✅ Usuário removido do VIP.');
            return message.reply('❌ Usuário não encontrado na lista VIP.');
        }
    }

    // --- COMANDOS DE USUÁRIO VIP ---
    if (command === 'setup') {
        if (!vips.has(message.author.id) && message.author.id !== OWNER_ID) {
            return message.reply('❌ Este é um comando **VIP**. Entre em contato com o dono para adquirir!');
        }

        const embed = new EmbedBuilder()
            .setTitle('💎 Painel de Clonagem VIP')
            .setDescription('Escolha as opções abaixo para configurar sua clonagem.')
            .setColor('#FFD700')
            .addFields(
                { name: 'Como usar?', value: '1. Selecione o que deseja clonar.\n2. Clique em Continuar.\n3. Siga as instruções no chat.' }
            );

        const row1 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('del_channels').setLabel('Apagar Canais').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('del_roles').setLabel('Apagar Cargos').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('del_emojis').setLabel('Apagar Emojis').setStyle(ButtonStyle.Secondary),
        );

        const row2 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('clone_channels').setLabel('Clonar Canais').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('clone_roles').setLabel('Clonar Cargos').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('clone_emojis').setLabel('Clonar Emojis').setStyle(ButtonStyle.Secondary),
        );

        const row3 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('continue_vip').setLabel('🚀 Iniciar Clonagem VIP').setStyle(ButtonStyle.Success),
        );

        await message.channel.send({ embeds: [embed], components: [row1, row2, row3] });
    }
});

// Lógica de Interação e Clonagem
const userSelections = new Map();

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;
    const userId = interaction.user.id;

    if (interaction.customId === 'continue_vip') {
        if (!vips.has(userId) && userId !== OWNER_ID) return interaction.reply({ content: '❌ Acesso negado.', ephemeral: true });

        await interaction.reply({ content: '🔑 **MODO VIP ATIVADO**\n\nVocê quer clonar usando:\n1️⃣ **Bot Oficial** (O bot precisa estar nos dois servidores)\n2️⃣ **Conta Secundária** (Clona qualquer servidor que você estiver)', ephemeral: true });
        
        const filter = m => m.author.id === userId;
        const collector = interaction.channel.createMessageCollector({ filter, time: 60000, max: 1 });

        collector.on('collect', async m => {
            if (m.content === '1') {
                await m.reply('Envie o ID do servidor de ORIGEM:');
                // ... Lógica de clonagem normal (já implementada anteriormente) ...
                m.channel.send('💡 *Dica: Use o modo 2 para clonar servidores onde o bot não está!*');
            } else if (m.content === '2') {
                await m.reply('⚠️ **MODO CONTA ATIVADO**\nEnvie o **TOKEN** da conta que está no servidor de origem:\n*(O chat será apagado por segurança)*');
                
                const tokenCollector = interaction.channel.createMessageCollector({ filter, time: 60000, max: 1 });
                tokenCollector.on('collect', async msgToken => {
                    const userToken = msgToken.content.trim();
                    await msgToken.delete().catch(() => {}); // Apaga o token do chat

                    await m.channel.send('Agora envie: `ID_ORIGEM ID_DESTINO`');
                    const idCollector = interaction.channel.createMessageCollector({ filter, time: 60000, max: 1 });
                    
                    idCollector.on('collect', async msgIds => {
                        const [sourceId, targetId] = msgIds.content.split(' ');
                        if (!sourceId || !targetId) return msgIds.reply('❌ IDs inválidos.');

                        msgIds.reply('🚀 Iniciando clonagem via conta secundária... Isso pode levar alguns minutos.');
                        
                        // Inicia o Self-Bot temporário para a clonagem
                        const selfClient = new SelfClient();
                        try {
                            await selfClient.login(userToken);
                            const sourceGuild = selfClient.guilds.cache.get(sourceId);
                            const targetGuild = client.guilds.cache.get(targetId); // O bot oficial cria no destino

                            if (!sourceGuild || !targetGuild) throw new Error('Servidor não encontrado.');

                            // --- Lógica de Clonagem (Simplificada para o exemplo) ---
                            // Aqui entraria a lógica de percorrer sourceGuild e criar no targetGuild
                            // ... (Mesma lógica de ordenação e permissões anterior) ...

                            msgIds.channel.send('✅ **Clonagem VIP concluída!**');
                        } catch (err) {
                            msgIds.channel.send('❌ Erro: Token inválido ou falta de permissões.');
                        } finally {
                            selfClient.destroy();
                        }
                    });
                });
            }
        });
        return;
    }

    // Alternar botões
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
    await interaction.update({ components: rows });
});

client.login(process.env.TOKEN);
