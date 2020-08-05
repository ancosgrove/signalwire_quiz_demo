# signalwire_quiz_demo
Signalwire Coder Games Demo

Signalwire held a coder games competition on 8/5/2020 and the ask was to make some kind of game that interfaced with the Signalwire API. My submission is a nodejs
relay app that interfaces with one of the freely available trivia DBs out in the wild (https://opentdb.com).

I threw this together in a few hours so it's a little bit on the raw side and the coding is a bit sloppy. In its current form the program will read in a categories.json file to present to the caller. Once
a category is chosen an API call is made to opentdb to grab 3 questions. If any questions are answered incorrectly then the player loses.

Feel free to look over the code, contribute, whatever.
