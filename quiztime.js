//////////////////////////////////////////////////////////////////////
//
// Written by Anthony Cosgrove for the 2020 ClueCon Coder Games
// August 4, 2020
//
//
// This Relay consumer client uses the free Trivia REST API at https://opentdb.com/
//
// There are several categories to choose from but I've limited it to 3 categories
// and 3 questions from the chosen category
//
// This is like the Bridge of Death :) --- Get any of the questions wrong and you lose.
//


const https = require('https')
const util = require('util')
const fs = require('fs')

const { RelayConsumer } = require('@signalwire/node')

var categories
var apiresult

/////////////// Question builder helper function ///////////////

function buildq(count,daq,ans) {
  ret = 'Question ' + count
  if (daq.type === 'boolean') {ret += '. true or false. '}
  if (daq.type === 'multiple') {ret += '. multiple-choice. '}
  ret += daq.question + ' '
  ansindex = 1
  ans.forEach(element => {
	ret += 'Press ' + ansindex + ', for: ' + element + '. '
	ansindex++
  })
  return ret
}

/////////////// Shuffles the answer array - Fisher-Yates algorithm ///////////////

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    let j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array
}

/////////////// CID lookup ///////////////

function cidLookup(number,user,pw) {
    console.log('Got to CNAM lookup')
    const options = {
        hostname: 'cosgrove.signalwire.com',
        path: '/api/relay/rest/lookup/phone_number/'+number+'?include=cnam',
        method: 'GET',
	headers: {
		'Authorization': 'Basic ' + new Buffer(user + ':' + pw).toString('base64')
	}
    }

    console.debug(options)
    var test = []
    request = https.get(options, function(res){
	var body = "";
	res.on('data', function(data) {
	   body += data;
	});
	res.on('end', function() {
	   //here we have the full response, html or json object
	   console.log('Info returned:',body)
	   test.push(body)
	})
	res.on('error', function(e) {
	   console.log("Got error: " + e.message);
	});
    });
    console.log('leaving request block. Contents of test:',test)
    return test
}

/////////////// Makes the API calls for the trivia questions ///////////////

function doEet(cid,success) {
    console.debug('Got to doEet')
    console.debug('1st param is:',cid)
    // Get 3 questions from the category chosen

    const options = {
        hostname: 'opentdb.com',
        path: '/api.php?amount=3&category='+cid,
        method: 'GET'
    }
    console.log('Fetching: ',options)
    const req = https.request(options, (res) => {
	res.setEncoding('utf-8')
        console.log(`statuscode: ${res.statusCode}`)
        var data = ''

        res.on('data' , (d) => {
           data += d
        })

        res.on('end', () => {
           var returnedData = JSON.parse(data)
	   success(returnedData)
        })

    })

    req.end()
}

/////////////// Main relay consumer code ///////////////

const consumer = new RelayConsumer({
  project: 'YOUR PROJECT SID',
  token: 'YOUR API TOKEN',
  contexts: ['codergames'],
  ready: async ({ client }) => {
    // Consumer is successfully connected with Relay.
    // You can make calls or send messages here..
    console.log('Reading category file\n')
    content = fs.readFileSync('categories.json')
    categories = JSON.parse(content)
    console.log(categories)
  },
  onIncomingCall: async (call) => {
    var incorrect = 0
    const { successful } = await call.answer()
    // if (!successful) { return }

    console.log('Call from:',call.from,'going to the quizzer.\nReading off the categories.\n')
    //info = cidLookup(call.from,consumer.project,consumer.token)
    //console.log('Caller info: ',info)
    //await call.playTTS({ text: 'Hello caller: ' + call.from.split('').join(' ') })
    await call.playTTS({ text: 'Hello caller. Please choose a category' })
    await new Promise(resolve => setTimeout(resolve, 1000))
    for (const category of categories.trivia_categories) {
	console.log(category.id,'-',category.name)
	await call.playTTS({ text: 'For:' + category.name + 'enter in. ' + category.id, gender: 'male'})
	await new Promise(resolve => setTimeout(resolve, 200))
    }
    const result = await call.prompt({
	type: 'digits',
	digits_max: 2,
	digits_terminators: '#',
	media: [ { type: 'tts', text: 'Please enter the category ID' },
		 { type: 'audio', url: 'https://sip.cosgrove.cc/tiktok.mp3' }]
    })
    if (result.successful) {
	const choice = categories.trivia_categories.filter(function(item) {
		if (result.result == item.id) return item.name
		return 0
	})
	console.log('User entered in: ', result.result, ':', choice[0].name ,'\n\n')
	await call.playTTS({ text: 'You have chosen: ' + choice[0].name })
	console.log('Fetching questions and saving.')
	doEet(result.result,function(stuff) {
	   data = JSON.stringify(stuff.results)
	   fs.writeFileSync('questions.json',data)
	})
	await new Promise(resolve => setTimeout(resolve, 1000))

	// A little Monty Python reference :)
	await call.playAudio({ url: 'https://sip.cosgrove.cc/mphg.wav', volume: -6 })

	//await call.playTTS({ text: 'Stop! Who would cross the Bridge of Death must answer me these questions three, ere the other side he see.', gender: 'male' })

	// Process the questions and present to the caller
	// The answers need to be shoved into one array and then randomized with the Fisher-Yates shuffle.
	var q_count = 1
	var answers = []
	content = fs.readFileSync('questions.json')
	questions = JSON.parse(content)
	//console.debug('Questions:',questions)
	for (const question of questions) {
	   //var askit = buildq(q_count,question)
	   //askit = decodeURI(askit)
	   //console.log(askit)
	   question.incorrect_answers.forEach( element => {answers.push(element)} )
	   answers.push(question.correct_answer)
	   // Attempt to randomize answer order
	   //console.debug('in:',answers)
	   answers = shuffle(answers)
	   var askit = buildq(q_count,question,answers)
           askit = decodeURI(askit)
           console.log(askit)
	   console.debug('out:',answers,'---',question.correct_answer)
	   const params = ({
		type: 'digits',
		initial_timeout: 0,
		digits_timeout: 30,
		digits_max: 1,
		media: [ 
			{ type: 'tts', text: askit },
			{ type: 'audio', url: 'https://sip.cosgrove.cc/think.mp3' }
		]
	   })
	   const promptResult = await call.prompt(params)
	   if (promptResult.successful) {
		index = promptResult.result - 1
		console.log('User entered in: ',promptResult.result,answers[index])
		if (answers[index] === question.correct_answer) {
			await call.playTTS({ text: 'Correct!' })
		} else {
			await call.playAudio('https://sip.cosgrove.cc/tpirbuzz.mp3')
			incorrect++
		}
	   }
	   q_count++
	   answers = []
	}
	// Even one incorrect answer gives the horns of defeat
	if (incorrect > 0) {
		await call.play({
			media: [
				{ type: 'tts', text: 'One or more answered incorrectly!' },
				{ type: 'audio', url: 'https://sip.cosgrove.cc/tpirhorns.wav' }
			],
			volume: -6
		})
	} else {
		await call.playAudio('https://sip.cosgrove.cc/tpircccwww.mp3')
	}
	await call.playAudio('https://sip.cosgrove.cc/tpir_theme.mp3')
    }
    await call.hangup()

  },
  onIncomingMessage: async function(message) {

    console.log('\nMessage from:',message.from)
    console.log('Message to:',message.to)
    console.log('Body:',message.body)
  }
})

consumer.run()
