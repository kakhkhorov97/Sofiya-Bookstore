# Task R

def calculate(expression):
    parts = expression.split(" ")

    num1 = int(parts[0])
    operator = parts[1]
    num2 = int(parts[2])

    if operator == "+":
        return num1 + num2


print(calculate("1 + 3"))

# Task Q

# def hasProperty(obj, prop):
#     return prop in obj


# print(hasProperty({"name": "BMW"}, "name"))
# print(hasProperty({"name": "BMW"}, "age"))


# Task P


# def objectToList(obj):
#     result = []

#     for key, value in obj.items():
#         result.append([key, value])

#     return result


# print(objectToList({"a": 10, "b": 20}))


# Task O

# def calculateSumOfNumbers(arr):
#     total = 0

#     for item in arr:
#         if type(item) == int or type(item) == float:
#             total += item

#     return total


# print(calculateSumOfNumbers([10, "10", {"son": 10}, True, 35]))

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
