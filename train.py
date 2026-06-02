# Task O

def calculateSumOfNumbers(arr):
    total = 0

    for item in arr:
        if type(item) == int or type(item) == float:
            total += item

    return total


print(calculateSumOfNumbers([10, "10", {"son": 10}, True, 35]))

# Task N


# def palindromeCheck(text):
#     return text == text[::-1]


# print(palindromeCheck("level"))


# Task M
# def getSquareNumbers(numbers):
#     result = []

#     for num in numbers:
#         result.append({
#             "number": num,
#             "square": num ** 2
#         })

#     return result


# print(getSquareNumbers([5, 4, 8]))


# def reverseSentence(sentence):
#     words = sentence.split(" ")
#     reversed_words = []

#     for word in words:
#         reversed_words.append(word[::-1])

#     return " ".join(reversed_words)


# print(reverseSentence("We want to sleep!!!"))
