import { Message, MessageEmbed, TextChannel } from 'discord.js';
import nodemailer from 'nodemailer';
import { staffPerms } from '@lib/permissions';
import { Course } from '@lib/types/Course';
import { SageUser } from '@lib/types/SageUser';
import { BOT, DB, EMAIL, MAINTAINERS } from '@root/config';
import { Command } from '@root/src/lib/types/Command';

export default class extends Command {

	runInDM = false;
	description = 'Warns a user for breaking the rules and deletes the offending message.';
	extendedHelp = 'This command must be used when replying to a message.';
	usage = '[reason]';

	permissions(msg: Message): boolean {
		return staffPerms(msg);
	}

	async run(msg: Message, [target, reason]: [Message, string]): Promise<Message> {
		if ('parentId' in msg.channel) {
			const course: Course = await msg.client.mongo.collection(DB.COURSES).findOne({ 'channels.category': msg.channel.parentId });

			if (course) {
				const staffChannel = msg.guild.channels.cache.get(course.channels.staff) as TextChannel;
				const embed = new MessageEmbed()
					.setTitle(`${msg.author.tag} Warned ${target.author.tag}`)
					.setFooter(`${target.author.tag}'s ID: ${target.author.id} | ${msg.author.tag}'s ID: ${msg.author.id}`)
					.addFields([{
						name: 'Reason',
						value: reason
					}, {
						name: 'Message content',
						value: target.content || '*This message had no text content*'
					}]);
				staffChannel.send({ embeds: [embed] });
			}
		}

		target.author.send(`Your message was deleted in ${target.channel} by ${msg.author.tag}. Below is the given reason:\n${reason}`)
			.catch(async () => {
				const targetUser: SageUser = await msg.client.mongo.collection(DB.USERS).findOne({ discordId: target.author.id });
				if (!targetUser) throw `${target.author.tag} (${target.author.id}) is not in the database`;
				this.sendEmail(targetUser.email, msg.author.tag, reason);
			});

		msg.delete();
		return target.delete();
	}

	async argParser(msg: Message, input: string): Promise<[Message, string]> {
		if (!msg.reference) {
			msg.delete();
			throw `${msg.author}, This command must be used when replying to a message`;
		}

		const target = await msg.channel.messages.fetch(msg.reference.messageId);

		if (!target) throw 'Something went wrong and I couldn\'t find that message.';

		if (target.author.id === BOT.CLIENT_ID) {
			target.delete();
			msg.delete();
			throw `You shouldn't have to warn Sage! Contact ${MAINTAINERS} if you believe there is a problem.`;
		}

		return [target, input === '' ? 'Breaking course or server rules' : input];
	}

	sendEmail(recipient: string, mod: string, reason: string): void {
		const mailer = nodemailer.createTransport({
			host: 'mail.udel.edu',
			port: 25
		});

		mailer.sendMail({
			from: EMAIL.SENDER,
			replyTo: EMAIL.REPLY_TO,
			to: recipient,
			subject: `UD CIS Discord Warning`,
			html: `<!DOCTYPE html>
	<html>
	<body>

		<h3>You were issued a warning on the UD CIS Discord server by ${mod}</h3>
		<p>Reason for warning:</p>
		<p>${reason}</p>

	</body>

	</html>`
		});
	}

}
