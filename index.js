// requiring necessary Node packages. Express helps start a server, fs (file-system) helps with reading and writing files, and axios handles http requests
const express = require('express')
const app = express()
const fs = require('fs')
const axios = require('axios')

// specify a port for the server to run on
const PORT = 3000

// initialize paths which we will be reading out files from later
const pathToDataFolder = './data/'
const pathToSchemaFolder = pathToDataFolder + 'schema/'

// start Node server
app.listen(PORT, () => console.log(`NAVA-THE is listening on port ${PORT}`))

// Going to start with reading out all files and folders inside of the data folder
fs.readdir(pathToDataFolder, (err, files) => {

    // handle errors
    if (err) throw err

    // filter out any files and folders that aren't text files
    const presentDataTextFiles = files.filter(file => file.split('.')[1] === 'txt')

    // Now we want to do something for each of those text files we found
    presentDataTextFiles.forEach(file => {

        // For each text file, we can grab the name (in this case, 'booleanmeasures')
        const getFileName = file.split('.')[0]

        // now that we have just the name and no extension, we can see if there's a CSV in the schema folder that matches that name
        const isMatchingCSVPresent = checkForMatchingSchemaCSV(getFileName)

        if (isMatchingCSVPresent) {

            // once we verify there's a matching CSV, we need to make sense of the data inside it.
            const csvFieldsArray = readAndMapSchemaCSVFields(pathToSchemaFolder + getFileName + '.csv')

            // So, we've made sense of the CSV/Schema file. Let's move forward with working with the data using that information
            const jsonToPost = transformDataFileToJson(pathToDataFolder + file, csvFieldsArray)

            jsonToPost.forEach(row => {
               axios.post('https://2swdepm0wa.execute-api.us-east-1.amazonaws.com/prod/NavaInterview/measures', row)
                .then(resp => console.log(`The status of the HTTP response is ${resp.status}. Message: ${resp.statusText}`))
                .catch(error => console.log(`There was an error posting the data: ${error}`))
            })
        }
        else {
            console.log(`Data file ${file} does not have a matching .csv file in the schema folder!`)
        }
    })
})

// Returns a boolean based off whether we find a CSV file with the same name as given
const checkForMatchingSchemaCSV = fileName => {

    // read out the schema folder files
    const matchingSchemaFile = fs.readdirSync(pathToSchemaFolder).filter(csv => {

        // we need to make sure not only the name matches what's given, but the extension is a csv file. We can check that at the same time.
        const splitSchemaFile = csv.split('.')
        const schemaFileName = splitSchemaFile[0]
        const schemaFileExtension = splitSchemaFile[1]
        const checkForMatchingCSVFile = schemaFileName === fileName && schemaFileExtension === 'csv'

        return checkForMatchingCSVFile
    })[0]

    // returns a true if a matching CSV was found, false otherwise
    return !!matchingSchemaFile
}

// This will return an array of objects, each object containing a name, width, and type key for each column in the CSV
const readAndMapSchemaCSVFields = csvFilePath => {

    // Read out the contents of the csv file path given into an array of objects, one for each row in the CSV
    const schemaFileContents = fs.readFileSync(csvFilePath, 'utf-8').split('\n').join('').split('\r')

    // For each of those rows (fields) we know that the data will come in a format like NAME,WIDTH,TYPE format, so let's go off that
    const schemaFields = schemaFileContents.map(field => {
        const fieldAttributesSplit = field.split(',')
        const name = fieldAttributesSplit[0]

        // convert to integer
        const width = Number(fieldAttributesSplit[1])
        const type = fieldAttributesSplit[2]

        return {
            name,
            width,
            type
        }
    })

    return schemaFields
}

// Takes in the path to the data file, as well as the CSV Schema fields array that we calculated in the function above.
const transformDataFileToJson = (dataFilePath, schemaFieldsArray) => {
    
    
    const dataFileContents = fs.readFileSync(dataFilePath, 'utf-8').split('\n').join('').split('\r')

    const dataFileToJson = dataFileContents.map(data => {
        const splitDataOnSpace = data.split(' ')
        const json = {}
        const name = splitDataOnSpace[0]
        json[schemaFieldsArray[0].name] = name
        
        const year = splitDataOnSpace[1].substr(0, 4)
        json[schemaFieldsArray[1].name] = year

        const required = splitDataOnSpace[1].substr(4, 1)
        json[schemaFieldsArray[2].name] = !!required

        if (splitDataOnSpace.length === 3) {
            json[schemaFieldsArray[3].name] = splitDataOnSpace[2]
        }
        else if (splitDataOnSpace.length === 2) {
            const minimumScore = splitDataOnSpace[1].substr(5)
            json[schemaFieldsArray[3].name] = Number(minimumScore)
        }
        return json
    })

    return dataFileToJson
}