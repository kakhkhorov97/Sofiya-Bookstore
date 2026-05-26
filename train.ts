//Task - M

function getSquareNumbers(numbers: number[]) {
    const result = [];
    for (const num of numbers) {
        result.push({
        number: num,
        square: num * num

        });
     } 
     return result;
}

console.log(getSquareNumbers([5, 8, 3]));


 


// function reverseSentence(sentence: string):string {
// return sentence
//  .split(" ").map(word => word.split("").reverse().join("")).join(" ");
// }

// console.log(reverseSentence("We want to sleep!!!"))