# read the js file encoding it with utf-8
with open("../books.js", "r", encoding="utf-8") as file:
    # find key "name": and its value "any", and store it in a list
    file = file.readlines()
    books = []
    formated_books = []
    for line in file:
        if "name" in line:
            # books.append(line.split(":")[1].strip().replace('"', ""))
            book = line.split(":")[1].strip().replace('"', "")
            # formated option(value="გამ") გამოსვლა
            formated_book = f'option(value="{book}") {book}'
            print(formated_book)
            formated_books.append(formated_book)
            # not formatted
            books.append(book)

# print the books
# print(formated_books)


