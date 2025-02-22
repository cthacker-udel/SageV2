import { Client, GuildMember, PartialGuildMember } from 'discord.js';
import { SageUser } from '@lib/types/SageUser';
import { DatabaseError } from '@lib/types/errors';
import { DB, GUILDS } from '@root/config';

async function memberAdd(member: GuildMember): Promise<void> {
	if (member.guild.id !== GUILDS.MAIN) return;

	const entry: SageUser = await member.client.mongo.collection(DB.USERS).findOne({ discordId: member.id });

	if (!entry) {
		throw new DatabaseError(`User ${member.user.tag} (${member.id}) does not exist in the database.`);
	}
	if (!entry.isVerified) {
		throw new Error(`User ${member.user.tag} (${member.id}) is not verified.`);
	}

	entry.roles.forEach(role => {
		member.roles.add(role, 'Automatically assigned by Role Handler on join.')
			.catch(async error => member.client.emit('error', error));
	});
}

async function memberUpdate(oldMember: GuildMember | PartialGuildMember, newMember: GuildMember): Promise<void> {
	if (newMember.roles.cache.size === oldMember.roles.cache.size || newMember.guild.id !== GUILDS.MAIN) return;

	const updated = await newMember.client.mongo.collection(DB.USERS).updateOne({ discordId: newMember.id }, {
		$set: {
			roles: [...newMember.roles.cache.keys()].filter(role => role !== GUILDS.MAIN)
		}
	});

	if (updated.matchedCount !== 1) {
		throw new DatabaseError(`User ${newMember.user.tag} (${newMember.id}) does not exist in the database.`);
	}
}

async function register(bot: Client): Promise<void> {
	bot.on('guildMemberAdd', member => {
		memberAdd(member)
			.catch(async error => bot.emit('error', error));
	});
	bot.on('guildMemberUpdate', async (oldMember, newMember) => {
		memberUpdate(oldMember, newMember)
			.catch(async error => bot.emit('error', error));
	});
}

export default register;
