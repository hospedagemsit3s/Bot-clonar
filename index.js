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

// Emojis Estilo Nitro (Substitua pelos IDs reais se quiser emojis animados específicos)
const EMOJIS = {
    clone: '<:1289969947199410249:1461879272586084497> ', // Ex: '<:nitro_clone:123456789>'
    bot: '🤖',
    clear: '🧹',
    trash: '🗑️',
    verify: '✅',
    warning: '⚠️'
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
            .setTitle(`${EMOJIS.clone} Central de Ferramentas VIP`)
            .setDescription('Selecione uma das funções abaixo para iniciar o processo.')
            .setColor('#2F3136')
            .addFields(
                { name: `${EMOJIS.clone} Clonagem de Servidor`, value: 'Copie canais, cargos e emojis.', inline: true },
                { name: `${EMOJIS.clear} Limpeza de DM`, value: 'Apague suas mensagens no privado.', inline: true },
                { name: `${EMOJIS.trash} Limpeza de Servidor`, value: 'Delete canais e cargos rapidamente.', inline: true }
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

// Armazenamento temporário para confirmações
const pendingClones = new Map();

client.on('interactionCreate', async (interaction) => {
    if (interaction.isStringSelectMenu()) {
        if (interaction.customId === 'select_tool') {
            const tool = interaction.values[0];
            
            if (tool.startsWith('tool_clone')) {
                const modal = new ModalBuilder()
                    .setCustomId(tool === 'tool_clone_self' ? 'modal_clone_self' : 'modal_clone_bot')
                    .setTitle('Configurar Clonagem');
                
                const rows = [
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('source').setLabel('ID do Servidor de ORIGEM (Souza)').setStyle(TextInputStyle.Short).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('target').setLabel('ID do Servidor de DESTINO (Marcos)').setStyle(TextInputStyle.Short).setRequired(true))
                ];

                if (tool === 'tool_clone_self') {
                    rows.unshift(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('token').setLabel('Token da Conta').setStyle(TextInputStyle.Short).setRequired(true)));
                }

                modal.addComponents(rows);
                await interaction.showModal(modal);
            }
            // ... outras ferramentas ...
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

                if (!sourceName || !targetName) {
                    return interaction.followUp({ content: '❌ Não consegui encontrar um dos servidores. Verifique os IDs!', ephemeral: true });
                }

                // Salva os dados para a confirmação
                const cloneKey = `${interaction.user.id}_${Date.now()}`;
                pendingClones.set(cloneKey, { sourceId, targetId, token, type: interaction.customId });

                const confirmEmbed = new EmbedBuilder()
                    .setTitle(`${EMOJIS.warning} CONFIRMAÇÃO DE CLONAGEM`)
                    .setDescription(`Você tem certeza que deseja clonar o servidor?\n\n**ORIGEM:** ${sourceName} (\`${sourceId}\`)\n**DESTINO:** ${targetName} (\`${targetId}\`)`)
                    .setColor('#FF0000')
                    .setFooter({ text: 'AVISO: Isso apagará TUDO no servidor de destino!' });

                const rowConfirm = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`confirm_${cloneKey}`).setLabel('SIM, CLONAR AGORA').setStyle(ButtonStyle.Danger),
                    new ButtonBuilder().setCustomId(`cancel_${cloneKey}`).setLabel('CANCELAR').setStyle(ButtonStyle.Secondary)
                );

                await interaction.followUp({ embeds: [confirmEmbed], components: [rowConfirm], ephemeral: true });
            } catch (e) {
                await interaction.followUp({ content: '❌ Erro ao verificar servidores. Verifique o Token ou IDs.', ephemeral: true });
            }
        }
    }

    if (interaction.isButton()) {
        const [action, key] = interaction.customId.split('_');
        if (action === 'confirm' || action === 'cancel') {
            const data = pendingClones.get(key);
            if (!data) return interaction.reply({ content: '❌ Sessão expirada.', ephemeral: true });

            if (action === 'cancel') {
                pendingClones.delete(key);
                return interaction.update({ content: '❌ Clonagem cancelada.', embeds: [], components: [] });
            }

            await interaction.update({ content: '🚀 Clonagem iniciada! Aguarde a conclusão...', embeds: [], components: [] });
            
            // EXECUÇÃO DA CLONAGEM (Lógica corrigida)
            try {
                const { sourceId, targetId, token, type } = data;
                let sourceGuild;
                
                if (token) {
                    const self = new SelfClient();
                    await self.login(token);
                    sourceGuild = self.guilds.cache.get(sourceId);
                    await executeClone(sourceGuild, client.guilds.cache.get(targetId));
                    self.destroy();
                } else {
                    sourceGuild = client.guilds.cache.get(sourceId);
                    await executeClone(sourceGuild, client.guilds.cache.get(targetId));
                }
                
                await interaction.followUp({ content: `✅ Clonagem de **${sourceGuild.name}** concluída com sucesso!`, ephemeral: true });
            } catch (err) {
                console.error(err);
                await interaction.followUp({ content: '❌ Erro crítico durante a clonagem.', ephemeral: true });
            } finally {
                pendingClones.delete(key);
            }
        }
    }
});

// FUNÇÃO DE CLONAGEM CORRIGIDA E COMPLETA
async function executeClone(sourceGuild, targetGuild) {
    if (!sourceGuild || !targetGuild) throw new Error('Servidores não encontrados');

    // 1. Limpar Destino
    const channels = await targetGuild.channels.fetch();
    for (const c of channels.values()) await c.delete().catch(() => {});
    
    const roles = await targetGuild.roles.fetch();
    for (const r of roles.values()) {
        if (r.editable && r.name !== '@everyone' && !r.managed) await r.delete().catch(() => {});
    }

    // 2. Clonar Cargos
    const roleMap = new Map();
    const sRoles = Array.from((await sourceGuild.roles.fetch()).values()).sort((a, b) => a.position - b.position);
    for (const r of sRoles) {
        if (r.name === '@everyone') {
            await targetGuild.roles.everyone.setPermissions(r.permissions);
            roleMap.set(r.id, targetGuild.roles.everyone.id);
        } else if (!r.managed) {
            const nr = await targetGuild.roles.create({
                name: r.name, color: r.color, permissions: r.permissions, hoist: r.hoist, mentionable: r.mentionable
            });
            roleMap.set(r.id, nr.id);
        }
    }

    // 3. Clonar Canais (Categorias primeiro)
    const sChannels = await sourceGuild.channels.fetch();
    const catMap = new Map();
    
    const cats = Array.from(sChannels.filter(c => c.type === ChannelType.GuildCategory || c.type === 'GUILD_CATEGORY').values()).sort((a, b) => a.position - b.position);
    for (const c of cats) {
        const nc = await targetGuild.channels.create({
            name: c.name, type: ChannelType.GuildCategory,
            permissionOverwrites: c.permissionOverwrites.cache.map(o => ({ id: roleMap.get(o.id) || o.id, allow: o.allow, deny: o.deny, type: o.type }))
        });
        catMap.set(c.id, nc.id);
    }

    const others = Array.from(sChannels.filter(c => c.type !== ChannelType.GuildCategory && c.type !== 'GUILD_CATEGORY').values()).sort((a, b) => a.position - b.position);
    for (const c of others) {
        if ([ChannelType.GuildText, ChannelType.GuildVoice, ChannelType.GuildAnnouncement, 'GUILD_TEXT', 'GUILD_VOICE'].includes(c.type)) {
            await targetGuild.channels.create({
                name: c.name, type: c.type === 'GUILD_TEXT' ? ChannelType.GuildText : (c.type === 'GUILD_VOICE' ? ChannelType.GuildVoice : c.type),
                parent: catMap.get(c.parentId),
                permissionOverwrites: c.permissionOverwrites.cache.map(o => ({ id: roleMap.get(o.id) || o.id, allow: o.allow, deny: o.deny, type: o.type }))
            });
        }
    }
}

client.login(process.env.TOKEN);
