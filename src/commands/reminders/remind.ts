import { BOT, DB } from '@root/config';
import { Message } from 'discord.js';
import { Reminder } from '@lib/types/Reminder';
import parse from 'parse-duration';
import { reminderTime } from '@lib/utils';
import { Command } from '@lib/types/Command';

export default class extends Command {


	description = `Have ${BOT.NAME} give you a reminder.`;
	usage = '<reminder> | <duration> | [repeat]';
	extendedHelp = 'Reminders can be set to repeat daily or weekly.';

	run(msg: Message, [reminder]: [Reminder]): Promise<Message> {
		msg.client.mongo.collection(DB.REMINDERS).insertOne(reminder);

		return msg.channel.send(`I'll remind you about that at ${reminderTime(reminder)}.`);
	}

	argParser(msg: Message, input: string): [Reminder] {
		const [content, rawDuration, rawRepeat] = input.split('|').map(part => part.trim());
		const weekWords = ['w', 'week', 'weekly'];
		const dayWords = ['d', 'day', 'daily'];

		const duration = parse(rawDuration);
		if (!duration) throw `**${rawDuration}** is not a valid duration.`;

		const repeat = rawRepeat
			? weekWords.includes(rawRepeat.toLowerCase())
				? 'weekly'
				: dayWords.includes(rawRepeat.toLowerCase())
					? 'daily'
					: 'error'
			: null;

		if (repeat === 'error') throw `**${rawRepeat}** is not a valid repeat value.`;

		return [{
			owner: msg.author.id,
			content,
			mode: msg.channel.type === 'DM' ? 'private' : 'public',
			expires: new Date(duration + Date.now()),
			repeat
		}];
	}

}
