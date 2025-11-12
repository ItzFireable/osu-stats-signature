import fs from 'fs';
import got from 'got';
import path from 'path';
import cheerio from 'cheerio';

const fetchAndParse = async (url) => {
	let response;
	try {
		response = await fetch(url);	
	} catch (error) {
		return null;
	}

	const body = await response.text();
	let data;
	try {
		data = JSON.parse(body);
	} catch (error) {
		return null;
	}
	return data;
};

export const getUser = async (username, server = 'osu.ppy.sh', playmode = 'std', includeTopPlays = false, includeSkills = false) => {
	if (username == '@example') {
		const filePath = path.join(process.cwd(), `/assets/example/user.json`);	
		return JSON.parse(fs.readFileSync(filePath, 'utf8'));
	}
	const playmodes = {
		std: 'Standard',
		taiko: 'Taiko',
		catch: 'CatchTheBeat',
		mania: 'Mania',
	}
	if (!playmodes[playmode]){
		return {
			error: `Invalid playmode ${playmode}`
		}
	}

	const response = await fetchAndParse(`https://${server}/user/${username}/${playmodes[playmode]}`);
	if (!response) {
		return {
			error: `Failed to get user data`
		}
	}

	const gradesResponse = await fetchAndParse(`https://${server}/user/${username}/grades?mode=${playmodes[playmode]}`);
	if (!gradesResponse) {
		return {
			error: `Failed to get user grades data`
		}
	}

	const scoresResponse = await fetchAndParse(`https://${server}/user/${username}/scores?mode=${playmodes[playmode]}&type=Best&limit=100`);
	if (!scoresResponse) {
		return {
			error: `Failed to get user scores data`
		}
	}

	const medalsResponse = await fetchAndParse(`https://${server}/user/${username}/medals?mode=${playmodes[playmode]}`);
	if (!medalsResponse) {
		return {
			error: `Failed to get user medals data`
		}
	}

	const firstPlacesResponse = await fetchAndParse(`https://${server}/user/${username}/scores?mode=${playmodes[playmode]}&type=Top`);
	if (!firstPlacesResponse) {
		return {
			error: `Failed to get user first places data`
		}
	}

	response.grades = gradesResponse;
	response.scores = scoresResponse;
	response.medals = medalsResponse;
	response.top_ranks = firstPlacesResponse;

	response.current_mode = playmode;

	return response;
}
export const getImage = async (url) => {
	if (url.startsWith('example_')){
		const filePath = path.join(process.cwd(), `/assets/example/${url}`);
		return Buffer.from(fs.readFileSync(filePath));
	}
	const response = await got({
		method: 'get',
		responseType: 'buffer',
		url,
	});
	return response.body;
}
export const getImageBase64 = async (url) => {
	if (url.startsWith('example_')){
		const filePath = path.join(process.cwd(), `/assets/example/${url}`);
		return "data:image/png;base64," + Buffer.from(fs.readFileSync(filePath)).toString('base64');
	}
	const response = await got({
		method: 'get',
		responseType: 'buffer',
		url,
	});
	return "data:image/png;base64," + Buffer.from(response.body).toString('base64');
}
export const getUserOsuSkills = async (username) => {
	const calcSingleSkill = (value, globalRank, countryRank) => {
		value = parseInt(value);
		globalRank = parseInt(globalRank);
		countryRank = parseInt(countryRank);
		return {
			"value": value,
			"globalRank": globalRank,
			"countryRank": countryRank,
			"percent": Math.min(value / 1000 * 100, 100)
		}
	}
	let response;
	try {
		response = await got({
			method: 'get',
			url: `https://osuskills.com/user/${username}`,
		});	
	} catch (error) {
		return {
			error: `Failed to get skills data`
		}
	}
	const body = response.body;

	try {
		let $ = cheerio.load(body);
		const values = $('.skillsList .skillValue');
		const globalRanks = $('#ranks .skillTop .world');
		const countryRanks = $('#ranks .skillTop .country');
		const names = ["stamina", "tenacity", "agility", "accuracy", "precision", "reaction", "memory"];
		let result = {skills: {}, tags: []};
		for (let i = 0; i <= 6; i++){
			result.skills[names[i]] = calcSingleSkill(
				values[i].children[0].data,
				globalRanks[i].children[0].data.substring(1),
				countryRanks[i].children[0].data.substring(1)
			);
		}

		const tags = $('.userRank .userRankTitle');
		for (let i of tags){
			result.tags.push(i.children[0].data.trim());
		}

		return result;
	} catch (error) {
		return null;
	}
}