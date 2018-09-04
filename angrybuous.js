(function () {

const MAX_PAGES_PER_REQ = 50;

const editor = document.getElementById('angrybuous-edit-area');

let allowedWords = new Set();
let forbiddenWords = new Set();

function getWords() {
	let matches = editor.value.match(/[a-z\-]+/ig);
	return new Set(matches ? matches.map(word => word.toLowerCase()) : undefined);
}

/* Remove ambiguous words */

function censorWord(word) {
	let re = new RegExp('\\b' + word + '\\b', 'ig');
	editor.value = editor.value.replace(re, '???');
}

function censorAll() {
	forbiddenWords.forEach(censorWord);
}

/* Check for disambiguation pages */

function classify(words) {
	// leave only new words
	allowedWords.forEach(word => words.delete(word));
	forbiddenWords.forEach(word => words.delete(word));
	
	// check new words, by batches of MAX_PAGES_PER_REQ
	words = Array.from(words);
	let promises = [];
	for (let begin = 0 ; begin < words.length ; begin += MAX_PAGES_PER_REQ) {
		let batchPromise = fetchPageList(words.slice(begin, begin + MAX_PAGES_PER_REQ))
			.then(parseResponse);
		promises.push(batchPromise);
	}	
	
	return Promise.all(promises);
}

// fetches disambiguation page list for set of words
function fetchPageList(words) {
	if(words.size > MAX_PAGES_PER_REQ) {
		console.error('Wikipedia API limits to 50 titles per request');
	}
	
	const baseUrl = 'https://en.wikipedia.org/w/api.php?origin=*&action=query&format=json&formatversion=2&titles=';
	let url = baseUrl + Array.from(words).map(getDisambiguationTitle).join('|');
	
	return new Promise(function (resolve, reject) {
		let xhr = new XMLHttpRequest();
		
		xhr.addEventListener('error', reject);
		xhr.addEventListener('abort', reject);
		
		xhr.addEventListener('load', function () {
			resolve(JSON.parse(xhr.response));
		});
		
		xhr.open('GET', url);
		xhr.send();
	});
}

// add words to ambiguous/allowed sets using wikipedia response
function parseResponse(response) {
	response.query.pages.forEach(function (page) {
		let word = page.title.split(' (disambiguation)')[0].toLowerCase();
		(page.missing ? allowedWords : forbiddenWords).add(word);
	});
}

function getDisambiguationTitle(word) {
	let titleCaseWord = word.charAt(0).toUpperCase() + word.substr(1).toLowerCase();
	return titleCaseWord + ' (disambiguation)';
}

// main function
function disambiguate() {
	classify(getWords())
		.then(() => censorAll());
}

/* Run on text changes */

editor.addEventListener('blur', () => disambiguate());

editor.addEventListener('keyup', function (e) {
	if (['.', '?', '!', 'Enter'].includes(e.key)) {
		disambiguate();
	}
});

editor.addEventListener('paste', function () {
	setTimeout(disambiguate); // run after paste
});

})();
