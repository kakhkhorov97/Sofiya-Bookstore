
function reverseSentence(sentence: string):string {
return sentence
 .split(" ").map(word => word.split("").reverse().join("")).join(" ");
}

console.log(reverseSentence("We want to sleep!!!"))