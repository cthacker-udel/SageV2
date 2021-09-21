import { BOT } from '@root/config';
import { InteractionCollector, Message, MessageActionRow, MessageButton, MessageEmbed } from 'discord.js';
import parse from 'parse-duration';
import prettyMilliseconds from 'pretty-ms';
import { Command } from '@lib/types/Command';

export default class extends Command {

	description = `Have ${BOT.NAME} create a poll for you`;
	aliases = ['vote'];
	usage = '<timespan>|<question>|<choice 1>|<choice2>|...|<choiceX>';
	extendedHelp = 'You can have two to ten choices.';
	runInDM = false;


	async run(msg: Message, [timespan, question, ...choices]: [number, string, ...Array<string>]): Promise<void> {
		const emotes = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'].slice(0, choices.length);

		const buttons: MessageButton[] = [];

		let count = 0;
		choices.forEach(value => {
			buttons.push(new MessageButton()
				.setCustomId(value)
				.setStyle('PRIMARY')
				.setLabel(value)
				.setEmoji(emotes[count++]));
		});

		const rows = [new MessageActionRow().addComponents(buttons.slice(0, 5))];
		if (buttons.length > 5) rows.push(new MessageActionRow().addComponents(buttons.slice(5)));

		let choiceText = '';
		choices.forEach((choice, option) => {
			choiceText += `${emotes[option]} ${choice}\n`;
		});
		choiceText = choiceText.trim();

		const pollEmbed = new MessageEmbed()
			.setTitle(`Poll from ${msg.member.displayName}`)
			.addField(question, choiceText)
			.setFooter(`This poll ends in ${prettyMilliseconds(timespan, { verbose: true })}`)
			.setColor('RANDOM');

		const pollMsg = await msg.channel.send({ embeds: [pollEmbed], components: rows });


		const collector = new InteractionCollector(msg.client, {
			filter: interaction => interaction.isButton(),
			interactionType: 'MESSAGE_COMPONENT',
			time: timespan
		});

		const voted: string[] = [];
		collector.on('collect', interaction => {
			if (!interaction.isButton()) return;
			const voter = interaction.user;

			if (voted.includes(voter.id)) {
				interaction.reply({
					ephemeral: true,
					content: 'Looks like you\'ve already voted in this poll. You cannot vote more than once!'
				});
				return;
			}

			voted.push(voter.id);

			interaction.reply({
				ephemeral: true,
				content: `Your vote for **${interaction.customId}** has been counted. Thanks for your participation!`
			});
		});

		const winEmbed = new MessageEmbed()
			.setTitle(`Poll from ${msg.member.displayName}`)
			.setColor(pollEmbed.color);

		collector.on('end', (collection) => {
			const voters: string[] = [];
			let winners: string[];
			let winningCount = 0;
			const votes: Map<string, number> = new Map<string, number>();
			collection.forEach((value) => {
				if (voters.includes(value.user.id) || !value.isButton()) return;
				voters.push(value.user.id);
				const key = value.customId;

				// count votes up
				if (!votes.has(key)) {
					votes.set(key, 1);
				} else {
					votes.set(key, votes.get(key) + 1);
				}

				// set the winner(s)
				if (votes.get(key) > winningCount) {
					winningCount = votes.get(key);
					winners = [key];
				} else if (votes.get(key) === winningCount) {
					winners.push(key);
				}
			});

			pollMsg.components.forEach(row => row.components.forEach(comp => comp.setDisabled(true)));
			if (winningCount === 0) {
				pollMsg.edit({
					embeds: [pollEmbed
						.addField('Results', 'The poll ended but it looks like no one voted! ☹')
						.setFooter('This poll has ended')],
					components: pollMsg.components
				});
				winEmbed.setDescription(`The poll ended but it looks like no one voted! ☹\n\n[Click to view poll](${pollMsg.url})`);
			} else {
				pollMsg.edit({
					embeds: [pollEmbed
						.addField('Results', `${this.winMessage(winners, winningCount)}`)
						.setFooter('This poll has ended')],
					components: pollMsg.components
				});
				winEmbed.setDescription(`${this.winMessage(winners, winningCount)}\n\n[Click to view poll](${pollMsg.url})`);
			}
			msg.channel.send({ embeds: [winEmbed] });
		});
	}

	argParser(_msg: Message, input: string): Array<number | string> {
		const [rawTimespan, ...rest] = input.split('|').map(arg => arg.trim());

		const timespan = parse(rawTimespan);
		if (!timespan) throw `**${rawTimespan}** is not a valid timespan!\n\nUsage: ${this.usage}`;

		if (rest.length < 3) throw 'I need at least two choices to make a poll.';
		if (rest.length > 11) throw 'Sorry but that\'s too many choices for me. Please use ten or less.';

		return [timespan, ...rest];
	}

	winMessage = (options: Array<string>, votes: number): string => options.length === 1
		? `**${options}** won the poll with ${votes} vote${votes === 1 ? '' : 's'}.`
		: `**${options.join('** & **')}** tied the poll with ${votes} vote${votes === 1 ? '' : 's'} each.`;

}
