// Task Q


function hasProperty(obj: Object, prop:string):boolean {
    return prop in obj;
}

console.log(hasProperty({ name: "BMW" }, "name"));
console.log(hasProperty({ name: "BMW" }, "age"));

//Task P

// function objectToArray(obj: object): [string, any][] {
//   return Object.entries(obj);
// }

// console.log(objectToArray({ a: 10, b: 20 }));

// Task N

// function palindromeCheck(text: string): boolean {
//     const reversed = text.split("").reverse().join("");
//     return text === reversed
// }

// console.log(palindromeCheck("level"))


//Task - M

// function getSquareNumbers(numbers: number[]) {
//     const result = [];
//     for (const num of numbers) {
//         result.push({
//         number: num,
//         square: num * num

//         });
//      } 
//      return result;
// }

// console.log(getSquareNumbers([5, 8, 3]));


 


// function reverseSentence(sentence: string):string {
// return sentence
//  .split(" ").map(word => word.split("").reverse().join("")).join(" ");
// }

// console.log(reverseSentence("We want to sleep!!!"))