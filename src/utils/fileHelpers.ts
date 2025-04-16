import fs from "fs";
import path from "path";

/**
 * Ensures that the directory for a given file path exists.
 * It creates any subdirectories if necessary.
 */
export const ensureDirectoryExists = (filePath: string): void => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
};

/**
 * Reads the contents of a file and returns it as a JSON array.
 * If the file doesn't exist or if parsing fails, returns an empty array.
 */
export const readJsonArrayFromFile = (filePath: string): any[] => {
  if (!fs.existsSync(filePath)) {
    // File doesn’t exist, return empty array
    return [];
  }

  try {
    const data = fs.readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(data);

    // If it's an array, return it; otherwise return empty array
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    // If an error occurs (file read or parse error), return empty array
    return [];
  }
};

/**
 * Writes the provided array to the file as JSON.
 */
export const writeJsonArrayToFile = (filePath: string, jsonArray: any[]): void => {
  fs.writeFileSync(filePath, JSON.stringify(jsonArray, null, 2));
};

/**
 * Appends a single object to the JSON array stored in filePath.
 */
export const appendObjectToJsonFile = (filePath: string, newData: any): void => {
  try {
    ensureDirectoryExists(filePath);
    const currentArray = readJsonArrayFromFile(filePath);
    currentArray.push(newData);
    writeJsonArrayToFile(filePath, currentArray);
    console.log(`Data appended to file: ${filePath}`);
  } catch (error) {
    console.error(`Error appending object to file: ${filePath}`, error);
  }
};
